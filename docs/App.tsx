import type { Component } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import Mapo from 'mapo.js';

const App: Component = () => {
  let ref: HTMLDivElement;
  let mapo: Mapo;

  onMount(() => {
    mapo = new Mapo({
      container: ref,
    });
  });

  onCleanup(() => {
    console.log('onCleanup');
    mapo?.destroy();
  });

  return <div ref={ref} class="w-screen h-screen" />;
};

export default App;
