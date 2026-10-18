import { useEffect } from 'react';
import { VERSION } from '../irc/constants';

/** Minimum time the splash is shown, in milliseconds */
const SPLASH_TIME = 1500;

/** The pIRC splash screen, shown when pIRC starts or from Arquivo > Sobre */
export default function Splash({ onClose, auto }: { onClose: () => void; auto: boolean }) {
  useEffect(() => {
    if (!auto) {
      return;
    }
    const timer = setTimeout(onClose, SPLASH_TIME);
    return () => clearTimeout(timer);
  }, [auto, onClose]);

  return (
    <div className="splash" role="dialog" aria-label="pIRC" onClick={onClose}>
      <div className="splash-box">
        <img src="images/splash.gif" alt="pIRC - portable IRC" width={450} height={238} />
        {!auto && (
          <div className="splash-credits">
            <p>
              <strong>pIRC {VERSION}</strong> — portable IRC, versão web
            </p>
            <p>Criado em 2026 por Ademir Constantino, com a colaboração de João Pedrosa.</p>
            <p>Software livre, distribuído sob a GNU General Public License versão 2 ou posterior.</p>
          </div>
        )}
      </div>
    </div>
  );
}
