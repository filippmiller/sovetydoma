import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import bridge, { type VKBridgeSubscribeHandler } from '@vkontakte/vk-bridge'
import { ConfigProvider, AdaptivityProvider, AppRoot } from '@vkontakte/vkui'
import '@vkontakte/vkui/dist/vkui.css'
import { App } from './App'

type Scheme = 'light' | 'dark'

// VK Bridge handshake. Required first call for any Mini App.
bridge.send('VKWebAppInit').catch(() => { /* running outside VK (local dev) is fine */ })

function Root() {
  const [colorScheme, setColorScheme] = useState<Scheme>('light')

  useEffect(() => {
    // Sync light/dark with the VK client theme (moderation checks this).
    bridge.send('VKWebAppGetConfig').then((cfg) => {
      const scheme = (cfg as { appearance?: string }).appearance
      if (scheme === 'dark' || scheme === 'light') setColorScheme(scheme)
    }).catch(() => {})

    const listener: VKBridgeSubscribeHandler = (e) => {
      if (e.detail.type === 'VKWebAppUpdateConfig') {
        const scheme = (e.detail.data as { appearance?: string }).appearance
        if (scheme === 'dark' || scheme === 'light') setColorScheme(scheme)
      }
    }
    bridge.subscribe(listener)
    return () => bridge.unsubscribe(listener)
  }, [])

  return (
    <ConfigProvider colorScheme={colorScheme}>
      <AdaptivityProvider>
        <AppRoot>
          <App />
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
