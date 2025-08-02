const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const copyFile = (src, dest) => {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
};

const build = async () => {
  try {
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true });
    }
    
    fs.mkdirSync('dist', { recursive: true });

    // Build TypeScript files
    await esbuild.build({
      entryPoints: {
        'popup': 'src/popup/index.tsx',
        'background': 'src/background.ts',
        'content': 'src/content.ts'
      },
      bundle: true,
      outdir: 'dist',
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'window'
      },
      external: ['chrome'],
      supported: {
        'bigint': true
      },
      mainFields: ['browser', 'module', 'main'],
      loader: {
        '.wasm': 'file'
      },
      plugins: [
        {
          name: 'node-modules-polyfill',
          setup(build) {
            // Provide empty implementations for Node.js built-in modules
            build.onResolve({ filter: /^(fs|path|crypto|http|https|child_process|os)$/ }, args => {
              return { path: path.resolve(__dirname, 'empty-module.js') };
            });
          }
        }
      ]
    });

    // Copy manifest.json and inject.js
    copyFile('public/manifest.json', 'dist/manifest.json');
    copyFile('public/icon16.png', 'dist/icon16.png');
    copyFile('public/icon32.png', 'dist/icon32.png');
    copyFile('public/icon192.png', 'dist/icon192.png');
    copyFile('public/icon512.png', 'dist/icon512.png');
    copyFile('public/usdc-logo.png', 'dist/usdc-logo.png');
    copyFile('src/inject.js', 'dist/inject.js');

    // Create popup.html
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hashield</title>
  <link href="https://fonts.googleapis.com/css2?family=Comic+Sans+MS&family=Orbitron:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap" rel="stylesheet">
  <style>
    /* Animation keyframes */
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes glow {
      0% { box-shadow: 0 0 5px #06D6A0; }
      50% { box-shadow: 0 0 20px #06D6A0, 0 0 30px #118AB2; }
      100% { box-shadow: 0 0 5px #06D6A0; }
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      background-color: #0A0F1F;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(255, 214, 102, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, rgba(6, 214, 160, 0.1) 0%, transparent 20%),
        radial-gradient(circle at 50% 50%, rgba(17, 138, 178, 0.05) 0%, transparent 50%);
      color: #FFFFFF;
      font-family: 'Comic Sans MS', 'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      overflow: hidden;
    }
    
    #root {
      position: relative;
      min-height: 100vh;
    }
    
    /* Buttons with 3D effect */
    button {
      background: linear-gradient(to bottom, #06D6A0, #118AB2);
      border: none;
      border-radius: 12px;
      color: white;
      padding: 10px 15px;
      font-family: 'Comic Sans MS', sans-serif;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 0 #0A0F1F, 0 8px 10px rgba(0, 0, 0, 0.3);
      position: relative;
      transition: all 0.1s;
      margin: 5px 0;
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 0 #0A0F1F, 0 10px 15px rgba(0, 0, 0, 0.3);
    }
    
    button:active {
      transform: translateY(2px);
      box-shadow: 0 2px 0 #0A0F1F, 0 5px 5px rgba(0, 0, 0, 0.3);
    }
    
    /* Input fields with cartoon style */
    input, textarea, select {
      background-color: #FFFFFF;
      border: 3px solid #FFD166;
      border-radius: 10px;
      padding: 10px;
      font-family: 'Comic Sans MS', sans-serif;
      font-size: 14px;
      box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1);
      transition: all 0.3s;
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #06D6A0;
      box-shadow: 0 0 15px rgba(6, 214, 160, 0.5), inset 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    /* Decorative elements */
    .cartoon-bubble {
      position: absolute;
      border-radius: 50%;
      opacity: 0.6;
      filter: blur(2px);
      z-index: -1;
    }
    
    /* Futuristic elements */
    .tech-line {
      position: absolute;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(6, 214, 160, 0.8), transparent);
      z-index: -1;
    }
    
    /* Card containers */
    .card {
      background: rgba(10, 15, 31, 0.8);
      border: 2px solid #06D6A0;
      border-radius: 15px;
      padding: 15px;
      margin: 10px 0;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
    
    /* Headings */
    h1, h2, h3, h4, h5 {
      font-family: 'Comic Sans MS', 'Orbitron', sans-serif;
      color: #FFD166;
      text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      margin-bottom: 15px;
      text-align: center;
    }
    
    /* Spinner/loader */
    .spinner {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 4px solid transparent;
      border-top-color: #06D6A0;
      border-bottom-color: #118AB2;
      animation: spin 1.5s linear infinite;
      margin: 20px auto;
    }
  </style>
</head>
<body>
  <!-- Decorative background elements - Cartoon Bubbles -->
  <div class="cartoon-bubble" style="top: 10%; left: 5%; width: 50px; height: 50px; background-color: #FFD166; animation: float 6s ease-in-out infinite;"></div>
  <div class="cartoon-bubble" style="top: 70%; left: 80%; width: 30px; height: 30px; background-color: #06D6A0; animation: float 7s ease-in-out infinite 1s;"></div>
  <div class="cartoon-bubble" style="top: 40%; left: 90%; width: 20px; height: 20px; background-color: #118AB2; animation: float 5s ease-in-out infinite 0.5s;"></div>
  <div class="cartoon-bubble" style="top: 25%; left: 15%; width: 15px; height: 15px; background-color: #FF6B6B; animation: float 4s ease-in-out infinite 0.2s;"></div>
  <div class="cartoon-bubble" style="top: 85%; left: 25%; width: 25px; height: 25px; background-color: #FFD166; animation: float 8s ease-in-out infinite 1.5s;"></div>
  
  <!-- Polka dot background pattern -->
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -2; opacity: 0.1; pointer-events: none;">
    <div style="position: absolute; top: 10%; left: 10%; width: 8px; height: 8px; border-radius: 50%; background-color: #FFD166;"></div>
    <div style="position: absolute; top: 20%; left: 30%; width: 5px; height: 5px; border-radius: 50%; background-color: #06D6A0;"></div>
    <div style="position: absolute; top: 40%; left: 15%; width: 6px; height: 6px; border-radius: 50%; background-color: #FF6B6B;"></div>
    <div style="position: absolute; top: 70%; left: 25%; width: 7px; height: 7px; border-radius: 50%; background-color: #118AB2;"></div>
    <div style="position: absolute; top: 85%; left: 60%; width: 4px; height: 4px; border-radius: 50%; background-color: #FFD166;"></div>
    <div style="position: absolute; top: 30%; left: 75%; width: 9px; height: 9px; border-radius: 50%; background-color: #06D6A0;"></div>
    <div style="position: absolute; top: 60%; left: 85%; width: 6px; height: 6px; border-radius: 50%; background-color: #FF6B6B;"></div>
  </div>
  
  <!-- Futuristic tech lines -->
  <div class="tech-line" style="top: 20%; left: 0; width: 100%; animation: glow 4s infinite;"></div>
  <div class="tech-line" style="top: 80%; left: 0; width: 100%; animation: glow 4s infinite 2s;"></div>
  <div class="tech-line" style="top: 40%; left: 0; width: 100%; animation: glow 5s infinite 1s;"></div>
  <div class="tech-line" style="top: 60%; left: 0; width: 100%; animation: glow 6s infinite 3s;"></div>
  
  <!-- Animated emoji decorations -->
  <div style="position: absolute; top: 5%; right: 5%; font-size: 24px; animation: float 5s ease-in-out infinite;">✨</div>
  <div style="position: absolute; bottom: 5%; left: 5%; font-size: 24px; animation: float 6s ease-in-out infinite 1s;">🚀</div>
  <div style="position: absolute; top: 50%; right: 10%; font-size: 24px; animation: float 7s ease-in-out infinite 0.5s;">🔍</div>
  
  <div id="root"></div>
  <script src="popup.js"></script>
</body>
</html>`;

    fs.writeFileSync('dist/popup.html', popupHtml);

    // Create a simple icon if it doesn't exist
    if (!fs.existsSync('public/icon.png')) {
      const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <rect width="16" height="16" fill="#007bff"/>
        <text x="8" y="12" text-anchor="middle" fill="white" font-family="Arial" font-size="10">W</text>
      </svg>`;
      
      fs.writeFileSync('public/icon.svg', iconSvg);
      console.log('Created icon.svg (you may want to create a proper icon.png)');
    }

    // Copy icon if it exists
    if (fs.existsSync('public/icon.png')) {
      copyFile('public/icon.png', 'dist/icon.png');
    }

    console.log('✅ Build completed successfully!');
    console.log('📁 Extension files are in the dist/ directory');
    console.log('🔧 Load the extension in Chrome by going to chrome://extensions and selecting the dist/ folder');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

build();