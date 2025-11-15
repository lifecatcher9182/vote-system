'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import AlertModal from './AlertModal';

export default function FaviconUploadSettings() {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({
    isOpen: false,
    message: '',
    title: '알림'
  });

  const loadFavicon = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('system_config')
      .select('favicon_url')
      .limit(1)
      .single();

    // 데이터가 없거나(PGRST116) 아직 설정되지 않은 경우는 무시
    if (error) {
      // PGRST116은 "행이 없음" 에러 - 정상적인 상황
      if (error.code !== 'PGRST116') {
        console.error('Favicon 로딩 오류:', error);
      }
      return;
    }

    if (data?.favicon_url) {
      setFaviconUrl(data.favicon_url);
    }
  }, []);

  useEffect(() => {
    loadFavicon();
  }, [loadFavicon]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 형식 검증 (이미지만 허용)
    if (!file.type.startsWith('image/')) {
      setAlertModal({
        isOpen: true,
        message: '이미지 파일만 업로드할 수 있습니다.',
        title: '파일 형식 오류'
      });
      return;
    }

    // 파일 크기 검증 (2MB 제한)
    if (file.size > 2 * 1024 * 1024) {
      setAlertModal({
        isOpen: true,
        message: '파일 크기는 2MB를 초과할 수 없습니다.',
        title: '파일 크기 오류'
      });
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();

      // 기존 favicon 삭제 (있는 경우)
      if (faviconUrl) {
        const oldFileName = faviconUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('logos')
            .remove([`favicon/${oldFileName}`]);
        }
      }

      // 새 파일 업로드
      const fileName = `favicon-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(`favicon/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(`favicon/${fileName}`);

      // DB 업데이트
      const { data: existing } = await supabase
        .from('system_config')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('system_config')
          .update({
            favicon_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('system_config')
          .insert([{ favicon_url: publicUrl }]);

        if (insertError) throw insertError;
      }

      setFaviconUrl(publicUrl);
      setAlertModal({
        isOpen: true,
        message: 'Favicon이 성공적으로 업로드되었습니다.\n브라우저를 새로고침하면 변경사항이 적용됩니다.',
        title: '업로드 완료'
      });
    } catch (error) {
      console.error('Favicon 업로드 오류:', error);
      const err = error as { message?: string; statusCode?: string; error?: string; hint?: string; details?: string };
      console.error('오류 상세:', {
        message: err?.message,
        statusCode: err?.statusCode,
        error: err?.error,
        hint: err?.hint,
        details: err?.details
      });
      setAlertModal({
        isOpen: true,
        message: `Favicon 업로드에 실패했습니다.\n${err?.message || '알 수 없는 오류'}`,
        title: '업로드 오류'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFavicon = async () => {
    if (!faviconUrl) return;

    setUploading(true);

    try {
      const supabase = createClient();

      // Storage에서 삭제
      const fileName = faviconUrl.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('logos')
          .remove([`favicon/${fileName}`]);
      }

      // DB 업데이트
      const { data: existing } = await supabase
        .from('system_config')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('system_config')
          .update({
            favicon_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      }

      setFaviconUrl(null);
      setAlertModal({
        isOpen: true,
        message: 'Favicon이 삭제되었습니다.\n브라우저를 새로고침하면 기본 아이콘으로 표시됩니다.',
        title: '삭제 완료'
      });
    } catch (error) {
      console.error('Favicon 삭제 오류:', error);
      setAlertModal({
        isOpen: true,
        message: 'Favicon 삭제에 실패했습니다.',
        title: '삭제 오류'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="card-apple p-8">
        <h2 className="text-2xl font-semibold mb-6" style={{ 
          color: '#1d1d1f',
          letterSpacing: '-0.02em'
        }}>
          Favicon 설정
        </h2>

        <div className="space-y-6">
          {/* 현재 Favicon 미리보기 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
              현재 Favicon
            </label>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-2xl overflow-hidden flex items-center justify-center" style={{ 
                background: 'rgba(0, 0, 0, 0.03)',
                border: '2px solid rgba(0, 0, 0, 0.06)'
              }}>
                {faviconUrl ? (
                  <Image
                    src={faviconUrl}
                    alt="Favicon"
                    width={128}
                    height={128}
                    className="object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400">Favicon 없음</p>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="space-y-3">
                  <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    브라우저 탭에 표시되는 작은 아이콘입니다
                  </p>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      <p className="mb-1">• 정사각형 이미지 권장 (512x512px, 256x256px, 64x64px 등)</p>
                      <p className="mb-1">• 지원 형식: PNG, ICO, SVG, JPG</p>
                      <p>• 최대 파일 크기: 2MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 업로드 버튼 */}
          <div className="flex gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <div
                className="w-full px-6 py-3 rounded-2xl font-semibold text-center transition-all duration-200 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: uploading ? 'rgba(0, 0, 0, 0.4)' : 'var(--color-secondary)',
                  color: 'white',
                  boxShadow: uploading ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                  letterSpacing: '-0.01em',
                  opacity: uploading ? 0.5 : 1,
                  pointerEvents: uploading ? 'none' : 'auto'
                }}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    업로드 중
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Favicon 업로드
                  </span>
                )}
              </div>
            </label>

            {faviconUrl && (
              <button
                onClick={handleRemoveFavicon}
                disabled={uploading}
                className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  letterSpacing: '-0.01em'
                }}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        title={alertModal.title}
      />
    </>
  );
}
