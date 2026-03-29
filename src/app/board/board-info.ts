export interface BoardFile {
  name: string;
  size: number;
  isDir: boolean;
}

export interface BoardInfo {
  platform: string;
  boardId: string;
  cpuFreqMhz: number;
  memFreeKb: number;
  memAllocKb: number;
  modules: string[];
}
