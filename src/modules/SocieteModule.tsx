import { useState } from 'react';
import { Save } from 'lucide-react';
import { store } from '../store';
import { Personnel, Societe } from '../types';
import PhoneInput from '../components/PhoneInput';

interface Props {
  user: Personnel;
}

const emojis = ['🍺', '🍻', '🍷', '🍸', '🍹', '🥃', '☕', '🍽️', '🏠', '⭐'];

export default function SocieteModule({ user: _user }: Props) {
  const [societe, setSociete] = useState<Societe>(store.getSociete());
  const [toast, setToast] = useState('');

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSave = () => {
    store.setSociete(societe);
    showMsg('Paramètres enregistrés');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">🏢 Paramètres société</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Type de logo</label>
          <div className="flex gap-4 mb-4">
            {(['emoji', 'image', 'none'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="logoType"
                  checked={societe.LOGO_TYPE === t}
                  onChange={() => setSociete({ ...societe, LOGO_TYPE: t })}
                  className="w-4 h-4 text-[#0D47A1]"
                />
                <span className="text-sm capitalize">{t === 'none' ? 'Aucun' : t === 'emoji' ? 'Emoji' : 'Image'}</span>
              </label>
            ))}
          </div>

          {societe.LOGO_TYPE === 'emoji' && (
            <div>
              <p className="text-sm text-gray-500 mb-2">Choisir un emoji</p>
              <div className="flex flex-wrap gap-2">
                {emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => setSociete({ ...societe, LOGO_EMOJI: e })}
                    className={`w-12 h-12 rounded-xl text-2xl transition-all ${
                      societe.LOGO_EMOJI === e ? 'ring-2 ring-[#0D47A1] bg-blue-50' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {societe.LOGO_TYPE === 'image' && (
            <div>
              <p className="text-sm text-gray-500 mb-2">URL de l'image ou base64</p>
              <input
                type="text"
                value={societe.LOGO_IMAGE || ''}
                onChange={e => setSociete({ ...societe, LOGO_IMAGE: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border"
                placeholder="https://..."
              />
              {societe.LOGO_IMAGE && (
                <div className="mt-2 w-20 h-20 border rounded-lg overflow-hidden">
                  <img src={societe.LOGO_IMAGE} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Infos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nom de l'établissement *</label>
            <input
              type="text"
              value={societe.NOM}
              onChange={e => setSociete({ ...societe, NOM: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone</label>
            <PhoneInput
              value={societe.TELEPHONE}
              onChange={v => setSociete({ ...societe, TELEPHONE: v })}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Adresse</label>
          <input
            type="text"
            value={societe.ADRESSE}
            onChange={e => setSociete({ ...societe, ADRESSE: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <input
            type="email"
            value={societe.EMAIL || ''}
            onChange={e => setSociete({ ...societe, EMAIL: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">NIF</label>
            <input
              type="text"
              value={societe.NIF || ''}
              onChange={e => setSociete({ ...societe, NIF: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">STAT</label>
            <input
              type="text"
              value={societe.STAT || ''}
              onChange={e => setSociete({ ...societe, STAT: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border"
            />
          </div>
        </div>

        {/* Impression */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={societe.UTILISER_IMPRIMANTE}
              onChange={e => setSociete({ ...societe, UTILISER_IMPRIMANTE: e.target.checked })}
              className="w-5 h-5 rounded text-[#0D47A1]"
            />
            <div>
              <p className="font-medium">Utiliser l'imprimante</p>
              <p className="text-sm text-gray-500">Impression directe des tickets de caisse</p>
            </div>
          </label>
        </div>

        {/* Bouton enregistrer */}
        <button
          onClick={handleSave}
          className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0] flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Enregistrer les paramètres
        </button>
      </div>

      {/* Aperçu */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold mb-4">Aperçu en-tête ticket</h3>
        <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm text-center max-w-[300px] mx-auto">
          {societe.LOGO_TYPE === 'emoji' && (
            <div className="text-3xl mb-2">{societe.LOGO_EMOJI}</div>
          )}
          {societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE && (
            <div className="flex justify-center mb-2">
              <img src={societe.LOGO_IMAGE} alt="Logo" className="w-12 h-12 object-contain" />
            </div>
          )}
          <div className="font-bold">{societe.NOM}</div>
          <div className="text-xs">{societe.ADRESSE}</div>
          <div className="text-xs">Tél: {societe.TELEPHONE}</div>
          {societe.NIF && <div className="text-xs">NIF: {societe.NIF}</div>}
        </div>
      </div>
    </div>
  );
}
