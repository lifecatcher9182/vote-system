# Modal Conversion Guide

This document provides instructions for completing the conversion of all system alert() and confirm() dialogs to designed modals across remaining admin pages.

## Completed Files ✅
- `app/admin/villages/page.tsx` - All alerts converted
- `app/admin/dashboard/page.tsx` - All alerts converted  
- `app/admin/codes/page.tsx` - All alerts converted

## Files Requiring Conversion

### Pattern to Follow

1. **Add imports:**
```typescript
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';
```

2. **Add state variables:**
```typescript
const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
  isOpen: false, 
  message: '', 
  title: '알림' 
});

const [confirmModal, setConfirmModal] = useState<{ 
  isOpen: boolean; 
  message: string; 
  title?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'primary';
}>({ 
  isOpen: false, 
  message: '', 
  title: '확인',
  onConfirm: () => {},
  variant: 'primary'
});
```

3. **Add modals at end of JSX (before closing `</div>`):**
```typescript
{/* Alert Modal */}
<AlertModal
  isOpen={alertModal.isOpen}
  onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
  message={alertModal.message}
  title={alertModal.title}
/>

{/* Confirm Modal */}
<ConfirmModal
  isOpen={confirmModal.isOpen}
  onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
  onConfirm={confirmModal.onConfirm}
  message={confirmModal.message}
  title={confirmModal.title}
  variant={confirmModal.variant}
/>
```

4. **Replace alert() calls:**
```typescript
// OLD
alert('메시지');

// NEW
setAlertModal({
  isOpen: true,
  message: '메시지',
  title: '적절한 제목'
});
```

5. **Replace confirm() calls:**
```typescript
// OLD
if (!confirm('정말 삭제하시겠습니까?')) {
  return;
}
// ... deletion code

// NEW
setConfirmModal({
  isOpen: true,
  message: '정말 삭제하시겠습니까?',
  title: '삭제 확인',
  variant: 'danger',
  onConfirm: async () => {
    // ... deletion code here
  }
});
```

---

## Remaining Files

### app/admin/settings/page.tsx
**Total alerts:** 13 | **Total confirms:** 1

**Alerts to replace:**
1. Line 37: `alert('관리자 권한이 없습니다.')` → title: '접근 권한 없음'
2. Line 94: `alert('이메일을 입력하세요.')` → title: '입력 오류'
3. Line 101: `alert('올바른 이메일 형식이 아닙니다.')` → title: '입력 오류'
4. Line 107: `alert('이미 등록된 관리자입니다.')` → title: '등록 불가'
5. Line 119: `alert('관리자 추가에 실패했습니다.\n오류: ${error.message}')` → title: '오류'
6. Line 123: `alert('${newEmail.trim()}이(가) 관리자로 추가되었습니다.\n해당 이메일로 Google 로그인하면 관리자 페이지에 접근할 수 있습니다.')` → title: '추가 완료'
7. Line 131: `alert('시스템 관리자 계정은 삭제할 수 없습니다.')` → title: '삭제 불가'
8. Line 137: `alert('본인 계정은 삭제할 수 없습니다.')` → title: '삭제 불가'
9. Line 143: `alert('최소 한 명의 관리자가 필요합니다.')` → title: '삭제 불가'
10. Line 159: `alert('관리자 삭제에 실패했습니다.')` → title: '오류'
11. Line 168: `alert('시스템 이름을 입력하세요.')` → title: '입력 오류'
12. Line 207: `alert('시스템 이름 저장에 실패했습니다.')` → title: '오류'
13. Line 211: `alert('시스템 이름이 저장되었습니다.')` → title: '저장 완료'

**Confirms to replace:**
1. Line 147: `confirm('정말 ${email}을(를) 관리자에서 제거하시겠습니까?')` → title: '관리자 제거', variant: 'danger'

---

### app/admin/elections/[id]/page.tsx  
**Total alerts:** ~20 | **Total confirms:** ~5

This is a LARGE file (~1500 lines). Key sections:

**Auth check (Line ~117):**
- `alert('관리자 권한이 없습니다.')` → title: '접근 권한 없음'

**Error handling (Line ~142):**
- `alert('투표를 불러오지 못했습니다.')` → title: '오류'

**Status change (Line ~226):**
- `alert('상태 변경에 실패했습니다.')` → title: '오류'

**Candidate operations (Lines 235-272):**
- `alert('후보자 이름을 입력하세요.')` → title: '입력 오류'
- `alert('후보자 추가에 실패했습니다.')` → title: '오류'
- `confirm('정말 이 후보자를 삭제하시겠습니까?')` → title: '후보자 삭제', variant: 'danger'
- `alert('후보자 삭제에 실패했습니다.')` → title: '오류'

**Code generation (Lines 282-318):**
- `alert('코드는 1-100개까지 생성 가능합니다.')` → title: '입력 오류'
- `alert('코드 생성에 실패했습니다.')` → title: '오류'
- `alert('${codeQuantity}개의 코드가 생성되었습니다.')` → title: '생성 완료'
- `alert('코드 생성 중 오류가 발생했습니다.')` → title: '오류'

**Code deletion (Lines 325-337):**
- `confirm('정말 이 코드를 삭제하시겠습니까?')` → title: '코드 삭제', variant: 'danger'
- `alert('코드 삭제에 실패했습니다.')` → title: '오류'

**Notes operations (Lines 470-514):**
- `alert('비고 추가에 실패했습니다.')` → title: '오류'
- `alert('비고 수정에 실패했습니다.')` → title: '오류'
- `confirm('정말 이 비고를 삭제하시겠습니까?')` → title: '비고 삭제', variant: 'danger'
- `alert('비고 삭제에 실패했습니다.')` → title: '오류'

**Code copy (Line 1162):**
- `alert('코드가 복사되었습니다.')` → title: '복사 완료'

**Vote threshold validation (Line 1308):**
- `alert('0보다 크고 100 이하의 값을 입력하세요.')` → title: '입력 오류'

**Threshold deletion (Line 1331):**
- `confirm('"${threshold.label}" 비율을 삭제하시겠습니까?')` → title: '비율 삭제', variant: 'danger'

---

### app/admin/elections/create/page.tsx
**Total alerts:** ~13

**Auth check (Line 60):**
- `alert('관리자 권한이 없습니다.')` → title: '접근 권한 없음'

**Validation alerts (Lines 116-156):**
- `alert('최소 2명의 후보자가 필요합니다.')` → title: '입력 오류'
- `alert('투표 제목을 입력하세요.')` → title: '입력 오류'
- `alert('마을을 선택하세요.')` → title: '입력 오류'
- `alert('직책을 입력하세요.')` → title: '입력 오류'
- `alert('최소 2명의 후보자를 입력하세요.')` → title: '입력 오류'
- `alert('최대 선택 수는 1 이상이어야 합니다.')` → title: '입력 오류'
- `alert('최대 선택 수는 후보자 수보다 클 수 없습니다.')` → title: '입력 오류'

**Operation results (Lines 217-287):**
- `alert('투표 생성에 실패했습니다.')` → title: '오류'
- `alert('후보자 생성에 실패했습니다.')` → title: '오류'
- `alert('투표가 성공적으로 생성되었습니다!')` → title: '생성 완료'
- `alert('투표 생성 중 오류가 발생했습니다.')` → title: '오류'

---

### app/admin/elections/[id]/monitor/page.tsx
**Total alerts:** 2

**Auth check (Line 69):**
- `alert('관리자 권한이 없습니다.')` → title: '접근 권한 없음'

**Error handling (Line 94):**
- `alert('투표를 불러오지 못했습니다.')` → title: '오류'

---

### app/admin/election-groups/[id]/page.tsx
**Total alerts:** ~15 | **Total confirms:** ~4

This is another LARGE file (~1500 lines). Key sections:

**Auth/Loading (Lines 96-116):**
- `alert('관리자 권한이 없습니다.')` → title: '접근 권한 없음'
- `alert('그룹을 찾을 수 없습니다.')` → title: '오류'

**Election deletion (Lines 170-188):**
- `confirm('"${electionTitle}" 투표를 삭제하시겠습니까?\n\n관련된 후보자, 투표 데이터도 모두 삭제됩니다.')` → title: '투표 삭제', variant: 'danger'
- `alert('투표 삭제에 실패했습니다.')` → title: '오류'
- `alert('투표가 삭제되었습니다.')` → title: '삭제 완료'

**Code generation (Lines 279-320):**
- `alert('코드는 1-100개까지 생성 가능합니다.')` → title: '입력 오류'
- `alert('투표를 먼저 생성해주세요.')` → title: '입력 오류'
- `alert('코드 생성에 실패했습니다.')` → title: '오류'
- `alert('${codeQuantity}개의 코드가 생성되었습니다.')` → title: '생성 완료'
- `alert('코드 생성 중 오류가 발생했습니다.')` → title: '오류'

**Code deletion (Lines 328-340):**
- `confirm('정말 이 코드를 삭제하시겠습니까?')` → title: '코드 삭제', variant: 'danger'
- `alert('코드 삭제에 실패했습니다.')` → title: '오류'

**Batch village creation (Lines 354-387):**
- `alert('생성할 마을을 선택하세요.')` → title: '입력 오류'
- `confirm('${selectedVillages.length}개 마을에 대한 투표를 생성하시겠습니까?')` → title: '일괄 생성', variant: 'primary'
- `alert('${selectedVillages.length}개의 투표가 생성되었습니다.')` → title: '생성 완료'
- `alert('일괄 생성 중 오류가 발생했습니다.')` → title: '오류'

**Batch position creation (Lines 396-457):**
- `alert('생성할 직책을 선택하세요.')` → title: '입력 오류'
- `confirm('${selectedPositions.length}개 직책에 대한 투표를 생성하시겠습니까?')` → title: '일괄 생성', variant: 'primary'
- `alert('${selectedPositions.length}개의 투표가 생성되었습니다.')` → title: '생성 완료'
- `alert('일괄 생성 중 오류가 발생했습니다.')` → title: '오류'

**Status change (Line 472):**
- `confirm(confirmMessage)` → Dynamic title and message, variant: 'primary'

---

## Summary Statistics

Total system popups to replace: **~90**
- AlertModal replacements: **~70**
- ConfirmModal replacements: **~20**

## Testing Checklist

After converting all files, test:
- [ ] Village management (add, edit, delete, toggle status)
- [ ] Dashboard admin access denial
- [ ] Code generation and deletion
- [ ] Settings (admin management, system name)
- [ ] Election creation validation
- [ ] Election detail (candidate/code/note operations)
- [ ] Election monitoring access
- [ ] Election group creation and management
- [ ] Batch operations (village/position creation)
- [ ] All error scenarios
- [ ] All success messages
- [ ] Keyboard ESC to close modals
- [ ] Click outside to close modals
