module.exports = {
  swSrc: 'sw.js',        // Arquivo Service Worker de origem
  swDest: 'sw.js',       // Arquivo Service Worker resultante
  globDirectory: './',   // Diretório base para busca de assets
  globPatterns: [        // Padrões de arquivos a serem injetados no precache
    '**/*.{html,js,css,webmanifest,png,ico}'
  ],
};
