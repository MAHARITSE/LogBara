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
  const [error, setError] = useState('');
  const [apiStatus] = useState(() => store.getApiStatus());

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
    } catch (err) {
      // Version WAMP (MySQL forcé) : affiche le vrai message (API/MySQL
      // injoignable, base absente...) au lieu du message d'identifiants.
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Identifiants incorrects ou compte désactivé'
      );
      setLoading(false);
    }
  };

  const renderLogo = () => {
    if (societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE) {
      return <img src={societe.LOGO_IMAGE} alt="Logo" className="w-12 h-12 object-contain" />;
    }
    if (societe.LOGO_TYPE === 'emoji' && societe.LOGO_EMOJI) {
      return <span className="text-3xl">{societe.LOGO_EMOJI}</span>;
    }
    return <span className="text-2xl font-bold text-white">{societe.NOM.charAt(0)}</span>;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#0a3b75] via-[#0d4f9e] to-[#072952]">
      {/* Login card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
        {/* Header — Bleu vif signature */}
        <div className="bg-gradient-to-b from-[#1976D2] to-[#125aa3] p-8 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-md">
            {renderLogo()}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">{societe.NOM}</h1>
          <p className="text-blue-100 text-sm mt-1 font-medium">Point de Vente</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          {error && store.getLastError() && store.getLastError() !== error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-xs text-center">
              {store.getLastError()}
            </div>
          )}
          {!apiStatus.connected && !error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-xs text-center">
              <p className="font-semibold">MySQL non connecté — mode local (données dans ce navigateur uniquement).</p>
              {apiStatus.message && <p className="mt-1 leading-snug">{apiStatus.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Identifiant</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fafc] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1976D2] focus:border-transparent outline-none transition-all text-gray-800"
              placeholder="Votre identifiant"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fafc] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1976D2] focus:border-transparent outline-none transition-all pr-12 text-gray-800"
                placeholder="••••••••"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
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
            className="w-full bg-[#1976D2] hover:bg-[#1565C0] active:bg-[#0D47A1] disabled:bg-[#8bb3e8] text-white py-3.5 rounded-xl font-semibold text-base shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin text-white" />
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>

      {/* Developer signature */}
      <div className="text-center mt-6 text-white/80 text-sm space-y-1">
        <p>Développé par <span className="font-bold text-white">MAHARITSE Hiacinthe Bertrand</span></p>
        <p className="text-white/70">📞 038 34 092 61</p>
      </div>
    </div>
  );
}
