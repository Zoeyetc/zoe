import type { MotionStudyVariant } from './motionStudyEvidence.ts';

export type StudyLine = Readonly<{ x: number; y: number; length: number; vertical: boolean }>;
export type StudyGeometry = Readonly<{ width: number; height: number; lines: readonly StudyLine[] }>;

function lineAt(root: DOMRect, element: Element, edge: 'top' | 'bottom' | 'left'): StudyLine | null {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return edge === 'left'
    ? { x: rect.left - root.left, y: rect.top - root.top, length: rect.height, vertical: true }
    : { x: rect.left - root.left, y: (edge === 'top' ? rect.top : rect.bottom) - root.top,
      length: rect.width, vertical: false };
}

/** Geometry is sampled on resize/source change, never in the animation hot path. */
export function collectStudyGeometry(root: HTMLElement, variant: MotionStudyVariant): StudyGeometry {
  const rect = root.getBoundingClientRect();
  const lines: StudyLine[] = [];
  const add = (selector: string, edge: 'top' | 'bottom' | 'left') => {
    root.querySelectorAll(selector).forEach(element => {
      const line = lineAt(rect, element, edge);
      if (line) lines.push(line);
    });
  };
  if (variant === 'b') {
    if (root.querySelector('.signal-progress-track')) add('.signal-progress-track', 'top');
    else add('.signal-live-command', 'bottom');
  } else {
    add('.signal-console-heading--performance', 'bottom');
    add('.listening-field-score', 'top');
    add('.listening-field-score', 'bottom');
    add('.listening-field-voice + .listening-field-voice', 'top');
    add('.listening-field-now-rule', 'left');
    add('.signal-performance-band > .signal-inspect', 'top');
    add('.signal-system-footer .signal-inspect', 'top');
  }
  return { width: rect.width, height: rect.height, lines };
}

type TimerExtension = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
  QUERY_RESULT_AVAILABLE_EXT: number;
  QUERY_RESULT_EXT: number;
  createQueryEXT(): WebGLQuery | null;
  beginQueryEXT(target: number, query: WebGLQuery): void;
  endQueryEXT(target: number): void;
  getQueryObjectEXT(query: WebGLQuery, pname: number): number | boolean;
  deleteQueryEXT(query: WebGLQuery): void;
};

const vertexSource = `
attribute vec2 a_unit;
uniform vec2 u_viewport;
uniform vec4 u_rect;
varying vec2 v_unit;
void main() {
  vec2 point = u_rect.xy + a_unit * u_rect.zw;
  gl_Position = vec4(point.x / u_viewport.x * 2.0 - 1.0,
    1.0 - point.y / u_viewport.y * 2.0, 0.0, 1.0);
  v_unit = a_unit;
}`;

const fragmentSource = `
precision mediump float;
varying vec2 v_unit;
uniform vec3 u_color;
uniform float u_activity;
uniform float u_progress;
uniform float u_vertical;
uniform float u_mode;
void main() {
  float along = mix(v_unit.x, v_unit.y, u_vertical);
  float across = mix(v_unit.y, v_unit.x, u_vertical);
  float core = pow(max(0.0, 1.0 - abs(across * 2.0 - 1.0)), 1.8);
  float alpha;
  if (u_mode < 0.5) {
    float spatial = 0.82 + 0.18 * sin(along * 18.0 + u_activity * 3.0);
    alpha = (0.035 + u_activity * 0.23) * core * spatial;
  } else if (u_mode < 1.5) {
    float spot = exp(-pow((along - u_progress) * 20.0, 2.0));
    alpha = u_activity * 0.72 * spot * core;
  } else {
    alpha = (0.03 + u_activity * 0.16) * core;
  }
  gl_FragColor = vec4(u_color, alpha);
}`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result = gl.createShader(type);
  if (!result) throw new Error('WebGL shader allocation failed');
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result) ?? 'WebGL shader compilation failed';
    gl.deleteShader(result);
    throw new Error(message);
  }
  return result;
}

function program(gl: WebGLRenderingContext) {
  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const result = gl.createProgram();
  if (!result) throw new Error('WebGL program allocation failed');
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) ?? 'WebGL program linking failed';
    gl.deleteProgram(result);
    throw new Error(message);
  }
  return result;
}

function accent(root: HTMLElement): readonly [number, number, number] {
  const hex = getComputedStyle(root).getPropertyValue('--performance-active').trim() || '#62f296';
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return match ? [1, 2, 3].map(index => parseInt(match[index], 16) / 255) as [number, number, number]
    : [98 / 255, 242 / 255, 150 / 255];
}

export function createMotionStudyRenderer(canvas: HTMLCanvasElement, root: HTMLElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false,
    stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const linked = program(gl);
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('WebGL buffer allocation failed');
  gl.useProgram(linked);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const unit = gl.getAttribLocation(linked, 'a_unit');
  gl.enableVertexAttribArray(unit);
  gl.vertexAttribPointer(unit, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['u_viewport', 'u_rect', 'u_color', 'u_activity', 'u_progress',
    'u_vertical', 'u_mode'].map(name => [name, gl.getUniformLocation(linked, name)]));
  const color = accent(root);
  const timer = gl.getExtension('EXT_disjoint_timer_query') as TimerExtension | null;
  let pending: WebGLQuery | null = null;
  let gpuMilliseconds: number | null = null;
  let frame = 0;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    resize(geometry: StudyGeometry) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(geometry.width * dpr));
      const height = Math.max(1, Math.round(geometry.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    },
    draw(variant: MotionStudyVariant, geometry: StudyGeometry, activity: number, progress: number) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(linked);
      gl.uniform2f(uniforms.u_viewport, geometry.width, geometry.height);
      gl.uniform3f(uniforms.u_color, ...color);
      gl.uniform1f(uniforms.u_activity, activity);
      gl.uniform1f(uniforms.u_progress, progress);
      gl.uniform1f(uniforms.u_mode, variant === 'a' ? 0 : variant === 'b' ? 1 : 2);
      if (timer && pending && timer.getQueryObjectEXT(pending, timer.QUERY_RESULT_AVAILABLE_EXT)) {
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
          gpuMilliseconds = Number(timer.getQueryObjectEXT(pending, timer.QUERY_RESULT_EXT)) / 1e6;
        }
        timer.deleteQueryEXT(pending);
        pending = null;
      }
      let measuringGpu = false;
      if (timer && !pending && frame % 90 === 0) {
        pending = timer.createQueryEXT();
        if (pending) {
          timer.beginQueryEXT(timer.TIME_ELAPSED_EXT, pending);
          measuringGpu = true;
        }
      }
      for (const line of geometry.lines) {
        const thickness = variant === 'b' ? 9 : variant === 'c' ? 2 + activity * 4 : 4;
        const rect = line.vertical
          ? [line.x - thickness / 2, line.y, thickness, line.length]
          : [line.x, line.y - thickness / 2, line.length, thickness];
        gl.uniform4f(uniforms.u_rect, rect[0], rect[1], rect[2], rect[3]);
        gl.uniform1f(uniforms.u_vertical, line.vertical ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (timer && measuringGpu) timer.endQueryEXT(timer.TIME_ELAPSED_EXT);
      frame += 1;
      return gpuMilliseconds;
    },
    dispose() {
      if (timer && pending) timer.deleteQueryEXT(pending);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(linked);
    },
  };
}
