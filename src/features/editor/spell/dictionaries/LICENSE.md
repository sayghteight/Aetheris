# Diccionarios ortográficos

Los ficheros de esta carpeta son datos de diccionario de Hunspell/MySpell, copiados
sin modificar de los paquetes npm `dictionary-es` y `dictionary-en` (proyecto
[wooorm/dictionaries](https://github.com/wooorm/dictionaries)).

Se vendorizan aquí, y no se importan como dependencia npm, por una razón práctica:
esos paquetes son ESM de Node, leen sus datos con `node:fs/promises` y su `exports`
solo expone `./index.js`, de modo que no se pueden usar en el bundle del navegador.
Aquí los ficheros se importan con `?raw` de Vite, que entrega el contenido como texto
—exactamente lo que espera el motor Hunspell.

Para actualizar un diccionario:

```sh
npm install --no-save dictionary-es dictionary-en
# y copiar de nuevo node_modules/dictionary-<idioma>/index.{aff,dic}
```

## Español — `es.aff`, `es.dic`

- Origen: [sbosio/rla-es](https://github.com/sbosio/rla-es), versión 2.8 (es_ES),
  empaquetado por [wooorm/dictionaries](https://github.com/wooorm/dictionaries) como
  `dictionary-es@4.0.0`.
- Licencia del diccionario y del fichero de afijos:
  **(GPL-3.0 OR LGPL-3.0 OR MPL-1.1)** — triple licencia disjunta, elegimos
  **MPL-1.1**.
- Autoría original: Santiago Bosio y los colaboradores de la comunidad en español
  (relación completa en el `license` del paquete original).
- Nota: los ficheros son copies sin modificar de los originales.

## Inglés — `en.aff`, `en.dic`

- Origen: [wordlist.aspell.net](http://wordlist.aspell.net/dicts/) (SCOWL),
  `en_US` versión 2020.12.07, empaquetado por wooorm/dictionaries como
  `dictionary-en@4.0.0`.
- Licencia del diccionario y del fichero de afijos: **(MIT AND BSD)**.
- Nota: los ficheros son copies sin modificar de los originales.

## Motor

El corrector en sí es [Typo.js](https://github.com/cfinke/Typo.js) (`typo-js`),
licencia **BSD-3-Clause**, instalado como dependencia npm normal.
