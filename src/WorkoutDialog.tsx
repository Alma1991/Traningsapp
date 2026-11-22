import React, { useEffect, useId, useRef } from 'react';

export function WorkoutDialog({title, children, close, busy, focusCancel}: {
 title: string;
 children: React.ReactNode;
 close: () => void;
 busy: boolean;
 focusCancel?: boolean;
}) {
 const dialog = useRef<HTMLDialogElement>(null);
 const cancel = useRef<HTMLButtonElement>(null);
 const titleId = useId();
 useEffect(() => {
  const element = dialog.current!;
  element.showModal();
  return () => element.close();
 }, []);
 useEffect(() => {
  if (focusCancel) cancel.current?.focus();
 }, [focusCancel]);

 return <dialog ref={dialog} className="card workout-dialog" aria-labelledby={titleId}
  onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
  <h2 id={titleId}>{title}</h2>
  {children}
  <button ref={cancel} type="button" className="text-button" disabled={busy} onClick={close}>Avbryt</button>
 </dialog>;
}
