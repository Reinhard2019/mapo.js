import { Accessor, createEffect, createSignal } from 'solid-js'

export default function createRemoteSources(urls: Accessor<string[] | undefined>) {
  const remoteSourceStatusMap: Record<string, 'loading' | 'done'> = {}
  const [remoteSourceMap, setRemoteSourceMap] = createSignal({})

  createEffect(() => {
    for (const url in remoteSourceMap()) {
      if (!urls()?.includes(url)) {
        setRemoteSourceMap(map => {
          delete map[url]
          return { ...map }
        })
      }
    }
    for (const url in remoteSourceStatusMap) {
      if (!urls()?.includes(url)) {
        delete remoteSourceStatusMap[url]
      }
    }

    urls()?.forEach(url => {
      if (remoteSourceStatusMap[url]) return

      remoteSourceStatusMap[url] = 'loading'
      void fetch(url)
        .then(async resp => await resp.json())
        .then(data => {
          setRemoteSourceMap(value => ({
            ...value,
            [url]: data,
          }))
          remoteSourceStatusMap[url] = 'done'
        })
        .catch(() => {
          delete remoteSourceStatusMap[url]
        })
    })
  })

  return () => Object.values(remoteSourceMap())
}
