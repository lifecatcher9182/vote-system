'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function LogoUploadSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadLogo = async () => {
      const supabase = createClient();
      
      const { data } = await supabase
        .from('system_config')
        .select('logo_url')
        .limit(1)
        .single();

      if (data && data.logo_url) {
        setLogoUrl(data.logo_url);
        setPreview(data.logo_url);
      }
    };

    loadLogo();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('PNG, JPG, SVG 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 검증 (2MB) - Supabase 무료 티어 1GB 스토리지 제한 고려
    if (file.size > 2 * 1024 * 1024) {
      alert('파일 크기는 2MB 이하여야 합니다. 로고는 작은 용량으로도 충분합니다!');
      return;
    }

    // 파일 선택하자마자 바로 업로드
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const supabase = createClient();

    try {
      // 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 1. 기존 모든 로고 파일 삭제 (용량 관리)
      // logo.png, logo.jpg, logo.jpeg, logo.svg 모두 삭제 시도
      const possibleFiles = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg'];
      await supabase.storage
        .from('logos')
        .remove(possibleFiles);
      // 에러 무시 - 파일이 없어도 상관없음

      // 2. 파일명을 logo.[확장자]로 고정
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `logo.${fileExt}`;

      // 3. Storage에 업로드 (upsert: true로 덮어쓰기)
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // 같은 이름이면 덮어쓰기
        });

      if (uploadError) {
        console.error('업로드 오류:', uploadError);
        alert('파일 업로드에 실패했습니다.');
        setUploading(false);
        return;
      }

      // 4. Public URL 가져오기
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 5. DB에 URL 저장
      const { data: existingConfig } = await supabase
        .from('system_config')
        .select('id')
        .limit(1)
        .single();

      if (existingConfig) {
        await supabase
          .from('system_config')
          .update({ 
            logo_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);
      } else {
        await supabase
          .from('system_config')
          .insert([{
            logo_url: publicUrl
          }]);
      }

      setLogoUrl(publicUrl);
      setPreview(publicUrl);
      setUploading(false);
      alert('로고가 업로드되었습니다!');

      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('업로드 오류:', error);
      alert('업로드 중 오류가 발생했습니다.');
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!logoUrl) return;
    
    if (!confirm('정말 로고를 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();

    try {
      // 1. Storage에서 모든 가능한 로고 파일 삭제
      const possibleFiles = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg'];
      await supabase.storage
        .from('logos')
        .remove(possibleFiles);

      // 2. DB에서 URL 제거
      const { data: existingConfig } = await supabase
        .from('system_config')
        .select('id')
        .limit(1)
        .single();

      if (existingConfig) {
        await supabase
          .from('system_config')
          .update({ 
            logo_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);
      }

      setLogoUrl(null);
      setPreview(null);
      alert('로고가 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="card-apple p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <svg className="w-6 h-6" style={{ color: 'rgb(59, 130, 246)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold" style={{ letterSpacing: '-0.02em' }}>로고 설정</h2>
      </div>
      
      <div className="space-y-6">
        {/* 로고 미리보기 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
            현재 로고
          </label>
          <div className="flex items-center justify-center w-full h-48 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.05) 100%)', border: '2px dashed rgba(0, 0, 0, 0.1)' }}>
            {preview ? (
              <div className="relative w-full h-full p-6">
                <Image
                  src={preview}
                  alt="로고 미리보기"
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-3 text-sm font-medium">로고가 설정되지 않았습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="logo-upload-input"
          />
          <label
            htmlFor="logo-upload-input"
            className={`flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            style={{
              background: 'var(--color-secondary)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              letterSpacing: '-0.01em',
              pointerEvents: uploading ? 'none' : 'auto'
            }}
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {logoUrl ? '새 로고 업로드' : '로고 업로드'}
              </>
            )}
          </label>
          {logoUrl && (
            <button
              onClick={handleDelete}
              disabled={uploading}
              className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                letterSpacing: '-0.01em'
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              삭제
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500" style={{ letterSpacing: '-0.01em' }}>
          PNG, JPG, SVG 파일 (최대 2MB) • 파일 선택 시 즉시 업로드됩니다
        </p>

        <div className="mt-6 p-5 rounded-2xl" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
          <p className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'rgb(59, 130, 246)' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            로고 표시 위치
          </p>
          <ul className="space-y-2 text-xs text-gray-700">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(16, 185, 129)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>투표자 메인 페이지 헤더</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(16, 185, 129)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>관리자 대시보드 헤더</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(16, 185, 129)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>로그인 페이지</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(16, 185, 129)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>로고 없을 시 시스템 이름 텍스트 표시</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
