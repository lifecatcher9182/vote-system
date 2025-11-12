'use client';

import { useState, useEffect, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { createClient } from '@/lib/supabase/client';

interface ColorThemeSettingsProps {
  onColorsChange?: (primary: string, secondary: string) => void;
}

export default function ColorThemeSettings({ onColorsChange }: ColorThemeSettingsProps) {
  const [primaryColor, setPrimaryColor] = useState('#f5f5f7');
  const [secondaryColor, setSecondaryColor] = useState('#0071e3');
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyColorsToDOM = useCallback((primary: string, secondary: string) => {
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);
    
    if (onColorsChange) {
      onColorsChange(primary, secondary);
    }
  }, [onColorsChange]);

  useEffect(() => {
    const loadColors = async () => {
      const supabase = createClient();
      
      // system_config 테이블에서 직접 컬럼 읽기
      const { data, error } = await supabase
        .from('system_config')
        .select('primary_color, secondary_color')
        .limit(1)
        .single();

      if (error) {
        console.error('색상 로딩 오류:', error);
        return;
      }

      if (data) {
        const primary = data.primary_color || '#f5f5f7';
        const secondary = data.secondary_color || '#0071e3';
        
        setPrimaryColor(primary);
        setSecondaryColor(secondary);
        applyColorsToDOM(primary, secondary);
      }
    };

    loadColors();
  }, [applyColorsToDOM]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    // 첫 번째 row를 가져오거나 생성
    const { data: existing } = await supabase
      .from('system_config')
      .select('id')
      .limit(1)
      .single();

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
      
      error = result.error;
    } else {
      // 새로 생성
      const result = await supabase
        .from('system_config')
        .insert([{
          primary_color: primaryColor,
          secondary_color: secondaryColor
        }]);
      
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('❌ 색상 저장 오류:', error);
      alert('색상 저장에 실패했습니다: ' + error.message);
      return;
    }

    // DOM에 즉시 적용
    applyColorsToDOM(primaryColor, secondaryColor);
    alert('색상 테마가 저장되었습니다!');
  };

  const handleReset = () => {
    if (!confirm('기본 색상으로 복구하시겠습니까?')) {
      return;
    }
    
    setPrimaryColor('#f5f5f7');
    setSecondaryColor('#0071e3');
    applyColorsToDOM('#f5f5f7', '#0071e3');
  };

  return (
    <div className="card-apple p-8">
      <h2 className="text-2xl font-semibold mb-6" style={{ 
        color: '#1d1d1f',
        letterSpacing: '-0.02em'
      }}>
        색상 테마
      </h2>
      
      <div className="space-y-8">
        {/* Primary Color */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
            배경 컬러
          </label>
          <div className="flex gap-4">
            <div className="relative">
              <button
                onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                className="w-24 h-24 rounded-2xl border-2 transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: primaryColor,
                  borderColor: primaryColor === '#ffffff' ? '#e5e5e7' : 'transparent',
                  boxShadow: 'var(--shadow-md)'
                }}
              />
              {showPrimaryPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowPrimaryPicker(false)}
                  />
                  <div className="absolute z-20 mt-3 rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
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
                className="input-apple mb-3 font-mono"
                placeholder="#f5f5f7"
              />
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                페이지 배경, 헤더, 카드 배경 등에 사용됩니다
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Color */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
            버튼 컬러
          </label>
          <div className="flex gap-4">
            <div className="relative">
              <button
                onClick={() => setShowSecondaryPicker(!showSecondaryPicker)}
                className="w-24 h-24 rounded-2xl border-2 border-transparent transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: secondaryColor,
                  boxShadow: 'var(--shadow-md)'
                }}
              />
              {showSecondaryPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowSecondaryPicker(false)}
                  />
                  <div className="absolute z-20 mt-3 rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
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
                className="input-apple mb-3 font-mono"
                placeholder="#0071e3"
              />
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                버튼, 링크, 강조 요소 등에 사용됩니다
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: 'var(--color-secondary)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              letterSpacing: '-0.01em'
            }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중
              </span>
            ) : '색상 저장'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(0, 0, 0, 0.06)',
              color: '#1d1d1f',
              letterSpacing: '-0.01em'
            }}
          >
            기본값 복구
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-5 rounded-2xl" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 113, 227, 0.1)' }}>
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-secondary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-2">적용 범위</p>
              <ul className="space-y-1.5 text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <span><strong className="font-medium text-gray-900">배경 컬러</strong>: 페이지 배경, 헤더, 카드 배경</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <span><strong className="font-medium text-gray-900">버튼 컬러</strong>: 버튼, 링크, 배지, 강조 요소</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>투표자 페이지 및 관리자 페이지 전체 적용</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
