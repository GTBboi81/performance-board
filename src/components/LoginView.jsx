// src/components/LoginView.jsx
import React, { useState } from 'react';
import { LogIn, User, Lock, AlertCircle, Sun, Moon } from 'lucide-react';

// loginTitle: ログイン画面の見出し専用。appName（ブラウザのタブ名・サイドバー表示）とは
// 用途が異なるため独立させている。
const LoginView = ({ onLogin, onGuestLogin, glassClass, appName = 'CallData Analysis', loginTitle = 'デモ実績ボードログイン画面', logoLight = null, logoDark = null, theme = 'dark', toggleTheme }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const success = await onLogin(userId, password);
      if (!success) {
        setError('IDまたはパスワードが間違っています');
      }
    } catch {
      setError('IDまたはパスワードが間違っています');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    if (isSubmitting || !onGuestLogin) return;
    setIsSubmitting(true);
    setError('');
    try {
      const success = await onGuestLogin();
      if (!success) {
        setError('ゲストログインに失敗しました。時間をおいて再度お試しください。');
      }
    } catch {
      setError('ゲストログインに失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // テーマに応じたロゴを選択（ダークモードならlogoDark優先、なければlogoLight）
  const currentLogo = theme === 'dark' ? (logoDark || logoLight) : logoLight;

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-100'}`}>
      {/* テーマ切り替えボタン */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-yellow-300' : 'bg-gray-200 hover:bg-gray-300 text-indigo-600'}`}
        title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className={`w-full max-w-md p-8 rounded-2xl ${glassClass} animate-in fade-in zoom-in duration-500`}>
        <div className="text-center mb-8">
          {currentLogo ? (
            <div className="mb-4">
              <img
                src={currentLogo}
                alt={appName}
                className="h-[60px] max-w-[280px] mx-auto object-contain"
              />
            </div>
          ) : (
            <h1 className={`text-3xl font-bold mb-3 leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {loginTitle}
            </h1>
          )}
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>アカウント情報を入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div className="space-y-2">
            <label className={`text-xs font-medium ml-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>ログインID</label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} size={18} />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="off"
                className={`w-full rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors ${theme === 'dark' ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20' : 'bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
                placeholder="ユーザーIDを入力"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-medium ml-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>パスワード</label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} size={18} />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className={`w-full rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors [-webkit-text-security:disc] ${theme === 'dark' ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20' : 'bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
                placeholder="パスワードを入力"
                style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            ログイン
          </button>
        </form>

        <div className={`my-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`} />
        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
            theme === 'dark'
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
              : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300'
          }`}
        >
          ゲストモードで見る
        </button>

      </div>
    </div>
  );
};

export default LoginView;
