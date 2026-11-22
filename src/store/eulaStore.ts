import { create } from 'zustand';

/**
 * Estado del dialogo de licencia de uso.
 *
 * El dialogo aparece solo (sin que el usuario lo pida) cuando la licencia
 * todavia no se ha aceptado; este almacen sirve para volver a abrirla mas
 * tarde desde los ajustes de la aplicacion.
 */
interface EulaState {
  /** Si el usuario ha pedido ver la licencia. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useEulaStore = create<EulaState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
