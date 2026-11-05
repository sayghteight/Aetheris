/**
 * Registro del editor que puede guardar ahora mismo.
 *
 * Los editores de la app (escenas del manuscrito y entradas del universo) son
 * componentes independientes y en cualquier momento hay uno solo con el foco.
 * Cada uno se registra al montarse y se desregistra al desmontarse, de forma
 * que "guardar ahora" (atajo Ctrl+S) siempre alcanza al editor visible.
 */

type SaveHandler = () => void | Promise<void>;

let activeHandler: SaveHandler | null = null;

/** Registra el editor activo y devuelve la funcion para cancelar el registro. */
export function registerSceneSaver(handler: SaveHandler): () => void {
  activeHandler = handler;
  return () => {
    if (activeHandler === handler) {
      activeHandler = null;
    }
  };
}

/** Ejecuta el guardado inmediato del editor activo, si hay alguno. */
export async function saveActiveScene(): Promise<void> {
  if (!activeHandler) return;
  try {
    await activeHandler();
  } catch (error) {
    console.error('No se pudo guardar la escena:', error);
  }
}
