import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';

interface Props {
  onLogin: (user: Personnel) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [societe] = useState(() => store.getSociete());
  const [error, setError] = useState(() => store.getLastError());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 400));

    try {
      const user = store.authenticate(login, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Identifiants incorrects ou compte désactivé');
        setLoading(false);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Connexion MySQL impossible');
      setLoading(false);
    }
  };

  const renderLogo = () => {
    if (societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE) {
      return <img src={societe.LOGO_IMAGE} alt="Logo" className="w-16 h-16 object-contain" />;
    }
    if (societe.LOGO_TYPE === 'emoji' && societe.LOGO_EMOJI) {
      return <span className="text-4xl">{societe.LOGO_EMOJI}</span>;
    }
    return <span className="text-3xl font-bold text-white">{societe.NOM.charAt(0)}</span>;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background — Navy profond + touche ambre premium */}
      <div className="absolute inset-0 bg-[#0F172A]" />
      
      {/* Texture subtile */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e2937_0.8px,transparent_1px)] bg-[length:5px_5px] opacity-40" />
      
      {/* Accent ambre en coin + bleu profond */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-900/20 rounded-full blur-3xl" />
      
      {/* Top accent bar ambre (signature) */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header — Navy profond + accent ambre */}
          <div className="bg-[#0F172A] p-8 text-center relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
            
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
              {renderLogo()}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{societe.NOM}</h1>
            <p className="text-amber-400 text-sm mt-1.5 font-medium">Point de Vente • Bar &amp; Restaurant</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Identifiant</label>
              <input
                type="text"
                value={login}
                onChange={e => setLogin(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent outline-none transition-all"
                placeholder="Votre identifiant"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent outline-none transition-all pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!login || !password || loading}
              className="w-full btn-primary py-3.5 rounded-xl font-semibold text-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* Developer signature */}
        <div className="text-center mt-6 text-white/60 text-sm">
          <p>Développé par <span className="text-white/80 font-medium">MAHARITSE Hiacinthe Bertrand</span></p>
          <p className="mt-1">📞 038 34 092 61</p>
        </div>
      </div>
    </div>
  );
}
