/// <reference types="vite/client" />

declare module '*?worker&url' {
  const url: string;
  export default url;
}

interface ImportMetaEnv {
  readonly VITE_HELPER_KEY?: string;
}
