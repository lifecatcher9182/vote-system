'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function LogoUploadSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setSelectedFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      // 기존 로고 삭제
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('logos')
            .remove([oldPath]);
        }
      }

      // 새 파일명 생성 (타임스탬프 + 원본 파일명)
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('업로드 오류:', uploadError);
        alert('파일 업로드에 실패했습니다.');
        setUploading(false);
        return;
      }

      // Public URL 가져오기
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // DB에 URL 저장
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
      // Storage에서 삭제
      const filePath = logoUrl.split('/').pop();
      if (filePath) {
        await supabase.storage
          .from('logos')
          .remove([filePath]);
      }

      // DB에서 URL만 제거 (row는 삭제하지 않음)
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
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">🖼️ 로고 설정</h2>
      
      <div className="space-y-4">
        {/* 로고 미리보기 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            현재 로고
          </label>
          <div className="flex items-center justify-center w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            {preview ? (
              <div className="relative w-full h-full p-4">
                <Image
                  src={preview}
                  alt="로고 미리보기"
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm">로고가 설정되지 않았습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 파일 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            새 로고 업로드
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          <p className="mt-1 text-xs text-gray-500">
            PNG, JPG, SVG 파일 (최대 5MB)
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {uploading ? '업로드 중...' : '📤 업로드'}
          </button>
          {logoUrl && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              🗑️ 삭제
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
          <p className="font-semibold mb-2">💡 로고 표시 위치</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>투표자 메인 페이지 헤더</li>
            <li>관리자 대시보드 헤더</li>
            <li>로그인 페이지</li>
            <li>로고 없을 시 시스템 이름 텍스트 표시</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
