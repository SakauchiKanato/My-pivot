function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#333', fontFamily: 'sans-serif' }}>
      
      <header style={{ 
        height: '80px', 
        backgroundColor: '#ffffff', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 40px', 
        borderBottom: '1px solid #e2e8f0' 
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1e1b29' }}>My pivot</h1><br />
        <p style={{ marginLeft: '20px', color: '#1e1b29' }}>迷った数だけ私は進んだ</p>
      </header>

      <div style={{ display: 'flex', flex: 1, padding: '40px', gap: '40px', alignItems: 'flex-start' }}>
        
        <div style={{ 
          width: '350px', 
          backgroundColor: '#1e1b29', // 濃い紫色
          color: '#fff', 
          padding: '30px', 
          borderRadius: '20px', // 四隅を丸くして独立したカードに
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', // 少し影をつけて浮かせる
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3 style={{ fontSize: '18px', margin: 0, color: '#fff' ,fontFamily: 'sans-serif', textAlign: 'left' }}>五里夢中モード</h3><br />
          <p style={{ color: '#fff', fontSize: '14px', lineHeight: '0', textAlign: 'left' }}>
            綺麗に書かなくていい。迷いをそのまま吐き出そう。
          </p>
          
          <div>
            <input 
              type="text" 
              placeholder="この迷いに名前をつけるなら？" 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#2d283e', color: '#fff' }} 
            />
          </div>

          <div>
            <textarea 
              placeholder="今の気持ちを殴り書き..." 
              rows={5}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#2d283e', color: '#fff', resize: 'none' }} 
            />
          </div>


          <button style={{ backgroundColor: '#5b3e85', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            この迷いを記録する
          </button>
        </div>


        <main style={{ flex: 1 }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 20px 0' }}>ピボット・タイムライン</h2>
          <p style={{ color: '#64748b' }}>ここに右側の白いカード（タイムライン）を並べていきます。</p>
        </main>

      </div>
    </div>
  );
}

export default App;