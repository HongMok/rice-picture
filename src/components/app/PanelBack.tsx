'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** 让子模块（如 GameStudio 进入具体游戏后）临时接管 Workbench 顶栏的「返回」行为。
 *  没有注册时，顶栏走默认 Link（回 /app/toolbox）。 */
type BackHandler = () => void;

const Ctx = createContext<{
  handler: BackHandler | null;
  setHandler: (h: BackHandler | null) => void;
} | null>(null);

export function PanelBackProvider({ children }: { children: React.ReactNode }) {
  const [handler, setHandler] = useState<BackHandler | null>(null);
  return <Ctx.Provider value={{ handler, setHandler }}>{children}</Ctx.Provider>;
}

/** 子模块用：当处于「二级/三级视图」时把返回处理器注册上去，视图退出时置回 null。
 *  一次只允许一个覆写（互动游戏是单栈场景，够用）。 */
export function usePanelBackOverride(handler: BackHandler | null) {
  const ctx = useContext(Ctx);
  const setHandler = ctx?.setHandler;
  useEffect(() => {
    if (!setHandler) return;
    setHandler(() => handler);
    return () => setHandler(() => null);
  }, [handler, setHandler]);
}

/** Workbench 顶栏用：读取当前 override。 */
export function usePanelBack() {
  const ctx = useContext(Ctx);
  return ctx?.handler ?? null;
}

/** 保持 hook 接口简洁，导出个空占位以防将来加东西 */
export const _typesOnly: unknown = null;
