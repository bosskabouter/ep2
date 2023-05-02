import './App.css'
import Peers from './Peers'
import WebPush from './WebPush'
function App (): JSX.Element {
  return (
    <div className="App"><WebPush/><Peers/>
    </div>
  )
}

export default App
