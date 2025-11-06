'use client';

import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { createClient } from '@/lib/supabase/client';

interface ColorThemeSettingsProps {
  onColorsChange?: (primary: string, secondary: string) => void;
}

export default function ColorThemeSettings({ onColorsChange }: ColorThemeSettingsProps) {
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyColorsToDOM = (primary: string, secondary: string) => {
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);
    
    if (onColorsChange) {
      onColorsChange(primary, secondary);
    }
  };

  useEffect(() => {
    const loadColors = async () => {
      const supabase = createClient();
      
      // system_config 테이블에서 직접 컬럼 읽기
      const { data, error } = await supabase
        .from('system_config')
        .select('primary_color, secondary_color')
        .limit(1)
        .single();

      console.log('🎨 색상 로딩 결과:', { data, error });

      if (error) {
        console.error('색상 로딩 오류:', error);
        return;
      }

      if (data) {
        const primary = data.primary_color || '#2563eb';
        const secondary = data.secondary_color || '#10b981';
        
        console.log('✅ 로드된 색상:', { primary, secondary });
        
        setPrimaryColor(primary);
        setSecondaryColor(secondary);
        applyColorsToDOM(primary, secondary);
      }
    };

    loadColors();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    console.log('💾 저장 시작:', { primaryColor, secondaryColor });

    // 첫 번째 row를 가져오거나 생성
    const { data: existing, error: fetchError } = await supabase
      .from('system_config')
      .select('id')
      .limit(1)
      .single();

    console.log('📋 기존 데이터:', { existing, fetchError });

    let error;
    if (existing) {
      // 업데이트
      const result = await supabase
        .from('system_config')
        .update({ 
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      console.log('🔄 업데이트 결과:', result);
      error = result.error;
    } else {
      // 새로 생성
      const result = await supabase
        .from('system_config')
        .insert([{
          primary_color: primaryColor,
          secondary_color: secondaryColor
        }]);
      
      console.log('➕ 생성 결과:', result);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('❌ 색상 저장 오류:', error);
      alert('색상 저장에 실패했습니다: ' + error.message);
      return;
    }

    console.log('✅ 색상 저장 완료!');

    // DOM에 즉시 적용
    applyColorsToDOM(primaryColor, secondaryColor);
    alert('색상 테마가 저장되었습니다!');
  };

  const handleReset = () => {
    if (!confirm('기본 색상으로 복구하시겠습니까?')) {
      return;
    }
    
    setPrimaryColor('#2563eb');
    setSecondaryColor('#10b981');
    applyColorsToDOM('#2563eb', '#10b981');
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">🎨 색상 테마 설정</h2>
      
      <div className="space-y-6">
        {/* Primary Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메인 컬러 (Primary Color)
          </label>
          <div className="flex gap-3">
            <div className="relative">
              <button
                onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                className="w-20 h-20 rounded-lg border-2 border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                style={{ backgroundColor: primaryColor }}
              />
              {showPrimaryPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowPrimaryPicker(false)}
                  />
                  <div className="absolute z-20 mt-2">
                    <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
                  </div>
                </>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                placeholder="#2563eb"
              />
              <p className="text-xs text-gray-500">
                버튼, 링크, 헤더 등에 사용됩니다
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            보조 컬러 (Secondary Color)
          </label>
          <div className="flex gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSecondaryPicker(!showSecondaryPicker)}
                className="w-20 h-20 rounded-lg border-2 border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                style={{ backgroundColor: secondaryColor }}
              />
              {showSecondaryPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowSecondaryPicker(false)}
                  />
                  <div className="absolute z-20 mt-2">
                    <HexColorPicker color={secondaryColor} onChange={setSecondaryColor} />
                  </div>
                </>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                placeholder="#10b981"
              />
              <p className="text-xs text-gray-500">
                강조 배지, 통계 카드 등에 사용됩니다
              </p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-3">미리보기</p>
          <div className="space-y-2">
            <button
              className="px-4 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              메인 버튼
            </button>
            <button
              className="px-4 py-2 text-white rounded-lg font-medium ml-2"
              style={{ backgroundColor: secondaryColor }}
            >
              보조 버튼
            </button>
            <div className="mt-2">
              <span 
                className="text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                메인 링크 색상
              </span>
              <span className="mx-2">|</span>
              <span 
                className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                style={{ backgroundColor: secondaryColor }}
              >
                보조 배지
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? '저장 중...' : '💾 색상 저장'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            🔄 기본값 복구
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
          <p className="font-semibold mb-2">💡 적용 범위</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>투표자 페이지 및 관리자 페이지 전체</li>
            <li>버튼, 링크, 배지, 헤더 배경</li>
            <li>통계 카드 및 강조 요소</li>
            <li>저장 후 모든 페이지에 즉시 적용됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
