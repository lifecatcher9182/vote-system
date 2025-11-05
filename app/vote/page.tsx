import Link from 'next/link';

export default function VotePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            투표 참여
          </h1>
          <p className="text-gray-600">
            참여코드를 입력하여 투표에 참여하세요
          </p>
        </div>

        <form className="space-y-6">
          <div>
            <label 
              htmlFor="code" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              참여코드
            </label>
            <input
              type="text"
              id="code"
              name="code"
              placeholder="예: H-K7M9P2"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            참여하기
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link 
            href="/" 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>참여코드가 없으신가요?</strong><br />
            관리자에게 문의하여 참여코드를 받으세요.
          </p>
        </div>
      </div>
    </div>
  );
}
