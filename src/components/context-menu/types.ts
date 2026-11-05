import React from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  /** Atajo de teclado que se muestra a la derecha del elemento. */
  shortcut?: string;
}

/**
 * Ambito del menu contextual: una zona de la aplicacion que aporta sus propias
 * acciones (por ejemplo, el editor TipTap).
 *
 * El proveedor global resuelve el ambito en el momento del clic derecho, de
 * forma que cada zona puede construir su menu segun su estado actual.
 */
export interface ContextMenuScope {
  id: string;
  /** Devuelve true si el nodo pulsado pertenece a este ambito. */
  matches: (target: Node) => boolean;
  /** Construye las acciones disponibles en el estado actual. */
  build: () => ContextMenuItem[];
  /**
   * Ejecuta la accion elegida. Devuelve `false` (o una promesa que resuelve a
   * `false`) si la accion no se pudo completar, para poder avisar al usuario.
   */
  run: (itemId: string) => void | boolean | Promise<void | boolean>;
}
