declare namespace React {
  type Attributes = {
    key?: string | number;
  };
  type ReactNode = any;
  type FC<P = any> = (props: P & Attributes) => any;
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  type SVGProps<T = any> = Record<string, unknown>;
  type MouseEvent<T = Element> = {
    clientX: number;
    clientY: number;
    currentTarget: T;
    target: T;
  };
  type FormEvent<T = Element> = {
    preventDefault(): void;
    currentTarget: T;
    target: T;
  };
  type Context<T> = {
    Provider: any;
    Consumer: any;
  };
  type MutableRefObject<T> = {
    current: T;
  };
  function createContext<T>(defaultValue: T): Context<T>;
  function useContext<T>(context: Context<T>): T;
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]): T;
  function useRef<T>(initialValue: T | null): MutableRefObject<T | null>;
  const StrictMode: any;
}

declare module 'react' {
  export = React;
  export as namespace React;
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
