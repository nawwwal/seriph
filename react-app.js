import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

const customStyles = {
  paper: '#F4F29A',
  ink: '#0D7E6C',
  rule: '1.5px',
  rhythm: '10px',
  radius: '2px'
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      :root{
        --paper:#F4F29A;
        --ink:#0D7E6C;
        --rule:1.5px;
        --rhythm:10px;
        --radius:2px;
      }
      html,body{height:100%}
      body{
        background: var(--paper);
        color: var(--ink);
        font-family: "League Spartan", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
        letter-spacing: -0.01em;
      }
      .rule{ border-color: var(--ink); border-width: var(--rule)}
      .rule-b{ border-bottom: var(--rule) solid var(--ink) }
      .rule-t{ border-top: var(--rule) solid var(--ink) }
      .rule-l{ border-left: var(--rule) solid var(--ink) }
      .rule-r{ border-right: var(--rule) solid var(--ink) }
      .cap-tight{ line-height: .9 }
      .btn-ink:hover{ background: var(--ink); color: var(--paper); }
      .ink-bg{ background: var(--ink); color: var(--paper); }
      .cover-stripe{
        background-image:
          linear-gradient(90deg, var(--ink) 22%, transparent 22% 44%, var(--ink) 44% 50%, transparent 50% 72%, var(--ink) 72% 78%, transparent 78%);
        background-size: 24px 100%;
        opacity:.12;
        pointer-events:none;
      }
      .caret::after{ content:"→"; display:inline-block; transform: translateY(0.02em); }
      .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .grid-poster-gap{ gap: calc(var(--rhythm) * 1.2) }
      .dashed-border {
        background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%230D7E6C' stroke-width='2' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
      }
      .pulse-animation { animation: pulse 2s infinite; }
      .step-number { width: 32px; height: 32px; border-radius: 50%; display:flex; align-items:center; justify-content:center; background-color:var(--ink); color:var(--paper); font-weight:bold; margin-right:12px; }
      .progress-bar { height: 6px; border-radius: var(--radius); background: var(--ink); opacity: 0.3; overflow: hidden; }
      .progress-fill { height: 100%; background: var(--ink); transition: width 0.3s ease-in-out; }
      .pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }
      .slide-in { animation: slideIn 0.3s ease-out forwards; }
      @keyframes slideIn { from{transform:translateY(10px);opacity:0;} to{transform:translateY(0);opacity:1;} }
      .fade-in { animation: fadeIn 0.3s ease-out forwards; }
      @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
      .specimen-container { position: relative; overflow: hidden; }
      .specimen-text { transition: transform 0.3s ease; }
      .specimen-container:hover .specimen-text { transform: translateY(-50%); }
      .specimen-pangram {
        position: absolute; bottom: 0; left: 0; right: 0;
        transform: translateY(100%); transition: transform 0.3s ease;
      }
      .specimen-container:hover .specimen-pangram { transform: translateY(0); }
      .style-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      .style-card:hover { transform: translateY(-4px); box-shadow: 0 4px 0 var(--ink); }
    `;
    document.head.appendChild(style);
    
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(style);
      document.head.removeChild(link);
    };
  }, []);

  return (
    <Router basename="/">
      <div className="w-screen h-screen flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/font-detail" element={<FontDetailPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/processing" element={<ProcessingPage />} />
        </Routes>
      </div>
    </Router>
  );
};

const Navigation = ({ currentPage }) => {
  const navigate = useNavigate();
  
  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2">
        <button 
          className={`uppercase font-bold rule px-3 py-1 rounded-[2px] text-sm ${currentPage === 'home' ? 'btn-ink ink-bg' : 'btn-ink'}`}
          onClick={() => navigate('/')}
        >
          Home
        </button>
        <button 
          className={`uppercase font-bold rule px-3 py-1 rounded-[2px] text-sm ${currentPage === 'welcome' ? 'btn-ink ink-bg' : 'btn-ink'}`}
          onClick={() => navigate('/welcome')}
        >
          Welcome
        </button>
        <button 
          className={`uppercase font-bold rule px-3 py-1 rounded-[2px] text-sm ${currentPage === 'processing' ? 'btn-ink ink-bg' : 'btn-ink'}`}
          onClick={() => navigate('/processing')}
        >
          Processing
        </button>
      </div>
    </nav>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const [familyCount, setFamilyCount] = useState(0);
  const [styleCount, setStyleCount] = useState(0);
  const [recentName, setRecentName] = useState('—');
  const [shelfMode, setShelfMode] = useState('spines');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFamilyCount(3);
      setStyleCount(14);
      setRecentName('Montserrat');
    }
  };

  const handleExport = () => {
    const csv = 'Family,Style,Weight,Class\n"Helvetica","Regular",400,"Sans"\n"Times New Roman","Regular",400,"Serif"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'type-shelf.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Navigation currentPage="home" />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Seriph
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label htmlFor="fontInput" className="cursor-pointer uppercase font-bold rule px-4 py-2 rounded-[2px] btn-ink text-sm sm:text-base">
                Add Fonts <span className="caret"></span>
              </label>
              <input 
                id="fontInput" 
                ref={fileInputRef}
                type="file" 
                accept=".ttf,.otf,.woff,.woff2" 
                multiple 
                className="hidden"
                onChange={handleFileChange}
              />
              <button className="uppercase font-bold rule px-4 py-2 rounded-[2px] text-sm sm:text-base btn-ink">
                Regenerate Covers
              </button>
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Upload font files—families are grouped automatically. Each family earns a custom cover reflecting its traits.
          </p>
        </header>

        <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Families</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">{familyCount}</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Styles</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">{styleCount}</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Recently Added</div>
              <div className="text-xl sm:text-2xl font-black truncate-2">{recentName}</div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => setShelfMode('spines')}
                  className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] ${shelfMode === 'spines' ? 'ink-bg' : 'btn-ink'}`}
                >
                  Spines
                </button>
                <button 
                  onClick={() => setShelfMode('covers')}
                  className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] ${shelfMode === 'covers' ? 'ink-bg' : 'btn-ink'}`}
                >
                  Covers
                </button>
              </div>
            </div>
          </div>
        </section>

        <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
          <div 
            className="relative rule rounded-[2px] overflow-hidden flex flex-col cursor-pointer"
            style={{ background: 'linear-gradient(180deg, #0D7E6C10, transparent 60%)' }}
            onClick={() => navigate('/font-detail')}
          >
            <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6">
              <div className="cover-stripe absolute inset-0"></div>
              <div className="w-full">
                <div className="text-[11vw] sm:text-[7vw] lg:text-[4vw] xl:text-[3.2vw] 2xl:text-[2.8vw] leading-none font-black uppercase tracking-tight family-sample truncate-2" style={{ fontFamily: 'Arial, sans-serif', letterSpacing: '-0.015em' }}>Aa</div>
              </div>
            </div>
            <div className="rule-t p-3 sm:p-4">
              <div className="uppercase text-xs font-bold opacity-80">Family</div>
              <div className="text-xl font-extrabold truncate family-name">Helvetica</div>
              <div className="mt-1 flex justify-between text-xs uppercase">
                <div><span className="font-bold">Styles:</span> <span>8</span></div>
                <div className="font-bold">Sans</div>
              </div>
            </div>
          </div>

          <div 
            className="relative rule rounded-[2px] overflow-hidden flex flex-col"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #0D7E6C22 0 6px, transparent 6px 14px)' }}
          >
            <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6">
              <div className="cover-stripe absolute inset-0"></div>
              <div className="w-full">
                <div className="text-[11vw] sm:text-[7vw] lg:text-[4vw] xl:text-[3.2vw] 2xl:text-[2.8vw] leading-none font-black uppercase tracking-tight family-sample truncate-2" style={{ fontFamily: 'Times New Roman, serif', letterSpacing: '-0.015em' }}>Rg</div>
              </div>
            </div>
            <div className="rule-t p-3 sm:p-4">
              <div className="uppercase text-xs font-bold opacity-80">Family</div>
              <div className="text-xl font-extrabold truncate family-name">Times New Roman</div>
              <div className="mt-1 flex justify-between text-xs uppercase">
                <div><span className="font-bold">Styles:</span> <span>4</span></div>
                <div className="font-bold">Serif</div>
              </div>
            </div>
          </div>

          <div 
            className="relative rule rounded-[2px] overflow-hidden flex flex-col"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, #0D7E6C14 0 50%, transparent 50% 100%), linear-gradient(#0D7E6C14, #0D7E6C14)',
              backgroundSize: '12px 100%, 100% 12px',
              backgroundPosition: '0 0, 0 calc(100% - 12px)',
              backgroundRepeat: 'repeat, no-repeat'
            }}
          >
            <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6">
              <div className="cover-stripe absolute inset-0" style={{ opacity: 0.2 }}></div>
              <div className="w-full">
                <div className="text-[11vw] sm:text-[7vw] lg:text-[4vw] xl:text-[3.2vw] 2xl:text-[2.8vw] leading-none font-black uppercase tracking-tight family-sample truncate-2" style={{ fontFamily: 'Courier New, monospace', letterSpacing: '-0.03em' }}>{'{ }'}</div>
              </div>
            </div>
            <div className="rule-t p-3 sm:p-4">
              <div className="uppercase text-xs font-bold opacity-80">Family</div>
              <div className="text-xl font-extrabold truncate family-name">Courier New</div>
              <div className="mt-1 flex justify-between text-xs uppercase">
                <div><span className="font-bold">Styles:</span> <span>2</span></div>
                <div className="font-bold">Mono</div>
              </div>
            </div>
          </div>

          <div className="relative rule p-4 sm:p-5 md:p-6 rounded-[2px] flex flex-col justify-between group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div>
              <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight">Drop Fonts</div>
              <p className="mt-2 text-sm sm:text-base">Drag files here or use Add Fonts.</p>
            </div>
            <div className="mt-6 rule-t pt-3 uppercase text-sm font-bold caret">TTF, OTF, WOFF, WOFF2</div>
            <div className="absolute inset-0 bg-emerald-700/0 transition-colors pointer-events-none group-hover:bg-emerald-700/5"></div>
          </div>
        </main>

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">A no-fuss library to browse, test, and tidy your type. One color, many voices.</p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Upload all styles for better grouping.</li>
                <li>Rename files to include weight/style.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Export</div>
              <button onClick={handleExport} className="mt-2 uppercase font-bold rule px-3 py-2 rounded-[2px] btn-ink text-sm">Download Catalog CSV</button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

const FontDetailPage = () => {
  const navigate = useNavigate();
  const [selectedStyle, setSelectedStyle] = useState('Regular');
  const [fontSize, setFontSize] = useState('24px');
  const [activeFilter, setActiveFilter] = useState('All');
  const [testText, setTestText] = useState('Type here to test Helvetica. This editable area allows you to see how the font renders at different sizes and weights.');

  const styles = [
    { name: 'Regular', weight: 400, italic: false },
    { name: 'Italic', weight: 400, italic: true },
    { name: 'Bold', weight: 700, italic: false },
    { name: 'Bold Italic', weight: 700, italic: true },
    { name: 'Light', weight: 300, italic: false },
    { name: 'Light Italic', weight: 300, italic: true },
    { name: 'Black', weight: 900, italic: false },
    { name: 'Black Italic', weight: 900, italic: true }
  ];

  return (
    <>
      <Navigation currentPage="detail" />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <button onClick={() => navigate('/')} className="inline-block uppercase font-bold text-sm mb-2 rule px-3 py-1 rounded-[2px] btn-ink caret">Back to shelf</button>
              <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
                Helvetica
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button className="uppercase font-bold rule px-4 py-2 rounded-[2px] text-sm sm:text-base btn-ink">
                Test in Text
              </button>
              <button className="uppercase font-bold rule px-4 py-2 rounded-[2px] text-sm sm:text-base btn-ink">
                Export Family
              </button>
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <p className="text-base sm:text-lg tracking-tight"><span className="font-bold">Type:</span> Sans Serif</p>
            <p className="text-base sm:text-lg tracking-tight"><span className="font-bold">Styles:</span> 8</p>
            <p className="text-base sm:text-lg tracking-tight"><span className="font-bold">Designer:</span> Max Miedinger, 1957</p>
          </div>
        </header>

        <section className="mt-8 mb-6">
          <div className="specimen-container rule p-6 rounded-[2px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #0D7E6C10, transparent 60%)' }}>
            <div className="cover-stripe absolute inset-0"></div>
            <div className="specimen-text text-[clamp(72px,10vw,180px)] leading-[0.9] font-black tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
              AaBbCcDdEeFf<br />0123456789
            </div>
            <div className="specimen-pangram text-2xl sm:text-3xl md:text-4xl font-normal mt-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              The quick brown fox jumps over the lazy dog.
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex justify-between items-center rule-b pb-4">
            <h2 className="uppercase font-black text-2xl sm:text-3xl">Styles</h2>
            <div className="flex gap-2">
              {['All', 'Regular', 'Bold', 'Italic'].map(filter => (
                <button 
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] ${activeFilter === filter ? 'ink-bg' : 'btn-ink'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {styles.map((style, idx) => (
              <div key={idx} className="style-card rule rounded-[2px] overflow-hidden">
                <div className="p-4 pb-2">
                  <div className="uppercase text-xs font-bold opacity-80">{style.name}</div>
                  <div className="text-sm opacity-70">Weight: {style.weight}</div>
                </div>
                <div className="px-4 pb-4">
                  <div 
                    className="text-5xl leading-tight" 
                    style={{ 
                      fontFamily: 'Arial, sans-serif',
                      fontWeight: style.weight,
                      fontStyle: style.italic ? 'italic' : 'normal'
                    }}
                  >
                    Aa
                  </div>
                  <div 
                    className="mt-2 text-lg" 
                    style={{ 
                      fontFamily: 'Arial, sans-serif',
                      fontWeight: style.weight,
                      fontStyle: style.italic ? 'italic' : 'normal'
                    }}
                  >
                    ABCDEFGHIJKLM<br />abcdefghijklm
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Type Tester</h2>
          <div className="mt-6 rule p-6 rounded-[2px]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-3">
                <select 
                  className="rule bg-transparent p-2 rounded-[2px]"
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                >
                  {styles.map(s => <option key={s.name}>{s.name}</option>)}
                </select>
                <select 
                  className="rule bg-transparent p-2 rounded-[2px]"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                >
                  <option>16px</option>
                  <option>18px</option>
                  <option>24px</option>
                  <option>32px</option>
                  <option>48px</option>
                  <option>64px</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTestText('Type here to test Helvetica. This editable area allows you to see how the font renders at different sizes and weights.')}
                  className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] btn-ink"
                >
                  Reset
                </button>
                <button 
                  onClick={() => navigator.clipboard.writeText(testText)}
                  className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] btn-ink"
                >
                  Copy
                </button>
              </div>
            </div>
            <div 
              contentEditable="true" 
              className="outline-none text-2xl" 
              style={{ fontFamily: 'Arial, sans-serif', fontSize }}
              suppressContentEditableWarning
              onInput={(e) => setTestText(e.currentTarget.textContent || '')}
            >
              {testText}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Character Set</h2>
          <div className="mt-6 rule p-6 rounded-[2px] overflow-x-auto">
            <div className="text-xl tracking-wide" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Uppercase</div>
                A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
              </div>
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Lowercase</div>
                a b c d e f g h i j k l m n o p q r s t u v w x y z
              </div>
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Numbers</div>
                0 1 2 3 4 5 6 7 8 9
              </div>
              <div>
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Punctuation</div>
                ! @ # $ % ^ &amp; * ( ) - _ = + [ ] {'{ }'} ; : ' " , . &lt; &gt; / ? \
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">A no-fuss library to browse, test, and tidy your type. One color, many voices.</p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Similar Fonts</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Arial</li>
                <li>Neue Haas Grotesk</li>
                <li>Aktiv Grotesk</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Actions</div>
              <div className="mt-2 flex gap-2">
                <button className="uppercase font-bold rule px-3 py-2 rounded-[2px] btn-ink text-sm">Download</button>
                <button className="uppercase font-bold rule px-3 py-2 rounded-[2px] btn-ink text-sm">Share</button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

const WelcomePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    navigate('/processing');
  };

  return (
    <>
      <Navigation currentPage="welcome" />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Seriph
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label 
                htmlFor="fontInput-w" 
                className="cursor-pointer uppercase font-bold rule px-4 py-2 rounded-[2px] btn-ink text-sm sm:text-base pulse-animation"
                onClick={() => navigate('/processing')}
              >
                Add Fonts <span className="caret"></span>
              </label>
              <input id="fontInput-w" ref={fileInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple className="hidden" />
              <button className="uppercase font-bold rule px-4 py-2 rounded-[2px] text-sm sm:text-base btn-ink opacity-50 cursor-not-allowed">
                Regenerate Covers
              </button>
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Upload font files—families are grouped automatically. Each family earns a custom cover reflecting its traits.
          </p>
        </header>

        <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Families</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">0</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Styles</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">0</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Recently Added</div>
              <div className="text-xl sm:text-2xl font-black truncate-2">—</div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
              <div className="flex gap-2 mt-1">
                <button className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] btn-ink">Spines</button>
                <button className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px]">Covers</button>
              </div>
            </div>
          </div>
        </section>

        <main className="mt-6 sm:mt-8 md:mt-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Welcome to Your Seriph</h2>
            <p className="mt-3 max-w-2xl mx-auto text-lg">Your personal font library is empty. Let's get started by adding some fonts.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <div className="flex flex-col items-center text-center p-6 rule rounded-[2px]">
              <div className="step-number">1</div>
              <h3 className="text-xl font-bold mt-4 mb-2">Upload Fonts</h3>
              <p className="mb-4">Click "Add Fonts" or drag and drop font files into the dropzone below.</p>
              <div className="mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-center text-center p-6 rule rounded-[2px]">
              <div className="step-number">2</div>
              <h3 className="text-xl font-bold mt-4 mb-2">Organize Automatically</h3>
              <p className="mb-4">Fonts are grouped into families with custom generated covers.</p>
              <div className="mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9"></line>
                  <line x1="4" y1="15" x2="20" y2="15"></line>
                  <line x1="10" y1="3" x2="8" y2="21"></line>
                  <line x1="16" y1="3" x2="14" y2="21"></line>
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-center text-center p-6 rule rounded-[2px]">
              <div className="step-number">3</div>
              <h3 className="text-xl font-bold mt-4 mb-2">Browse Your Collection</h3>
              <p className="mb-4">Switch between spines and covers view to explore your library.</p>
              <div className="mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </div>
            </div>
          </div>

          <div 
            className={`relative dashed-border rounded-[2px] p-12 flex flex-col items-center justify-center text-center max-w-3xl mx-auto min-h-[300px] group cursor-pointer ${isDragOver ? 'bg-emerald-700/5' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-6">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight mb-4">Drop Fonts Here</div>
            <p className="mb-6 text-lg">Drag and drop font files or click to browse</p>
            <p className="uppercase text-sm font-bold caret">TTF, OTF, WOFF, WOFF2</p>
          </div>

          <div className="mt-12 max-w-3xl mx-auto">
            <h3 className="uppercase font-bold text-lg mb-4">Supported Font Formats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { ext: '.TTF', name: 'TrueType Font' },
                { ext: '.OTF', name: 'OpenType Font' },
                { ext: '.WOFF', name: 'Web Open Font' },
                { ext: '.WOFF2', name: 'Web Open Font 2' }
              ].map((format, idx) => (
                <div key={idx} className="p-4 rule rounded-[2px] text-center">
                  <div className="text-2xl font-bold mb-1">{format.ext}</div>
                  <div className="text-sm">{format.name}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">A no-fuss library to browse, test, and tidy your type. One color, many voices.</p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Upload all styles for better grouping.</li>
                <li>Rename files to include weight/style.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Export</div>
              <button className="mt-2 uppercase font-bold rule px-3 py-2 rounded-[2px] btn-ink text-sm opacity-50 cursor-not-allowed">Download Catalog CSV</button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

const ProcessingPage = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(33);
  const [processedCount, setProcessedCount] = useState(2);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const newProgress = prev + 1;
        if (newProgress === 50) setProcessedCount(3);
        else if (newProgress === 75) setProcessedCount(4);
        else if (newProgress === 90) setProcessedCount(5);
        else if (newProgress === 100) setProcessedCount(6);
        return newProgress;
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Navigation currentPage="processing" />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Seriph
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label htmlFor="fontInput-p" className="cursor-pointer uppercase font-bold rule px-4 py-2 rounded-[2px] btn-ink text-sm sm:text-base">
                Add Fonts <span className="caret"></span>
              </label>
              <input id="fontInput-p" type="file" accept=".ttf,.otf,.woff,.woff2" multiple className="hidden" />
              <button className="uppercase font-bold rule px-4 py-2 rounded-[2px] text-sm sm:text-base btn-ink">
                Regenerate Covers
              </button>
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Upload font files—families are grouped automatically. Each family earns a custom cover reflecting its traits.
          </p>
        </header>

        <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Families</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">3</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Styles</div>
              <div className="text-2xl sm:text-3xl font-black cap-tight">8</div>
            </div>
            <div className="rule-r p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Recently Added</div>
              <div className="text-xl sm:text-2xl font-black truncate-2">Montserrat</div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
              <div className="flex gap-2 mt-1">
                <button className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px] btn-ink">Spines</button>
                <button className="uppercase text-xs font-bold rule px-2 py-1 rounded-[2px]">Covers</button>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 sm:mt-8 md:mt-10 rule rounded-[2px] p-6 fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="uppercase font-black text-xl">Processing Fonts</h2>
            <div className="uppercase text-sm font-bold">
              <span>{processedCount}</span>/<span>6</span> Files
            </div>
          </div>

          <div className="w-full progress-bar mb-6">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="uppercase text-sm font-bold mb-3">Files Being Processed</h3>
              <div className="space-y-4">
                <div className="rule p-3 rounded-[2px] slide-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">Montserrat-Bold.ttf</div>
                      <div className="text-sm mt-1">Analyzing font metrics...</div>
                    </div>
                    <div className="pulse uppercase text-xs font-bold">Processing</div>
                  </div>
                  <div className="mt-3 progress-bar">
                    <div className="progress-fill" style={{ width: '60%' }}></div>
                  </div>
                </div>

                {['Montserrat-Regular.ttf', 'Montserrat-Light.ttf', 'Playfair-Regular.ttf'].map((file, idx) => (
                  <div key={idx} className="rule p-3 rounded-[2px] slide-in">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{file}</div>
                        <div className="text-sm mt-1">Queued for processing</div>
                      </div>
                      <div className="uppercase text-xs font-bold opacity-70">Queued</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="uppercase text-sm font-bold mb-3">Organized Families</h3>
              <div className="space-y-4">
                <div className="rule p-3 rounded-[2px] slide-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-lg">Roboto</div>
                      <div className="text-sm mt-1">Family complete with 3 styles</div>
                    </div>
                    <div className="uppercase text-xs font-bold ink-bg px-2 py-1 rounded-[2px]">Sans</div>
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="font-bold">Styles:</span> Regular, Bold, Italic
                  </div>
                </div>

                <div className="rule p-3 rounded-[2px] slide-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-lg">Montserrat</div>
                      <div className="text-sm mt-1">Family in progress</div>
                    </div>
                    <div className="uppercase text-xs font-bold ink-bg px-2 py-1 rounded-[2px]">Sans</div>
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="font-bold">Styles:</span> 1 processed, 3 pending
                  </div>
                  <div className="mt-2 progress-bar">
                    <div className="progress-fill" style={{ width: '25%' }}></div>
                  </div>
                </div>

                <div className="rule p-3 rounded-[2px] slide-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-lg">Playfair</div>
                      <div className="text-sm mt-1">New family detected</div>
                    </div>
                    <div className="uppercase text-xs font-bold ink-bg px-2 py-1 rounded-[2px]">Serif</div>
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="font-bold">Styles:</span> 0 processed, 1 pending
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm">
              <span className="font-bold">Estimated time remaining:</span> 1 minute 20 seconds
            </div>

            <button 
              onClick={() => navigate('/')}
              className="uppercase font-bold rule px-4 py-2 rounded-[2px] btn-ink text-sm"
            >
              View Shelf <span className="caret"></span>
            </button>
          </div>
        </div>

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">A no-fuss library to browse, test, and tidy your type. One color, many voices.</p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Upload all styles for better grouping.</li>
                <li>Rename files to include weight/style.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Export</div>
              <button className="mt-2 uppercase font-bold rule px-3 py-2 rounded-[2px] btn-ink text-sm">Download Catalog CSV</button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default App;