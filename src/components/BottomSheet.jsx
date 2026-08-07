export default function BottomSheet({ open, onClose, children }) {
  return (
    <>
      <div className={`sheet-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`sheet${open ? ' open' : ''}`}>
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  );
}
