declare module 'gifuct-js' {
  export interface ParsedGif {
    lsd: {
      width: number;
      height: number;
    };
    frames: unknown[];
  }

  export interface ParsedFrame {
    dims: {
      width: number;
      height: number;
      top: number;
      left: number;
    };
    delay: number;
    disposalType: number;
    patch: Uint8ClampedArray;
    transparentIndex?: number;
  }

  export function parseGIF(arrayBuffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(gif: ParsedGif, buildImagePatches: boolean): ParsedFrame[];
}

