import type { ErrorInfo } from '../irc/IrcClient';
import Dialog from './Dialog';

/** Shows an error, port of PIRCExceptionWindow.java */
export default function ErrorDialog({ error, onClose }: { error: ErrorInfo; onClose: () => void }) {
  return (
    <Dialog title={error.title} banner="images/exception_top.gif" width={360} onClose={onClose}>
      <p className="dialog-message error-message">{error.message}</p>
      <div className="dialog-buttons">
        <button type="button" className="primary" onClick={onClose}>
          OK
        </button>
      </div>
    </Dialog>
  );
}
