/** Asynchronous GPU timing: never waits for a result or stalls the render loop. */
export class GpuTimer {
  private extension: {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  private frame = 0;
  private history: number[] = [];
  p90 = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  }
  begin() {
    const ext = this.extension;
    if (!ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (
      this.pending.length &&
      gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)
    ) {
      const query = this.pending.shift()!;
      if (!disjoint) {
        this.history.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        if (this.history.length > 20) this.history.shift();
        const sorted = [...this.history].sort((a, b) => a - b);
        this.p90 = sorted[Math.floor(sorted.length * 0.9)];
      }
      gl.deleteQuery(query);
    }
    if (++this.frame % 30 || this.pending.length >= 4) return;
    this.active = gl.createQuery();
    if (this.active) gl.beginQuery(ext.TIME_ELAPSED_EXT, this.active);
  }
  end() {
    if (!this.active || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }
  dispose() {
    this.end();
    this.pending.forEach((query) => this.gl.deleteQuery(query));
    this.pending = [];
  }
}
