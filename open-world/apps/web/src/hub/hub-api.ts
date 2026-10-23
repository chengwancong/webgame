/**
 * Hub 接口层。字段名以 backend-B0-B4.md §2 为准。
 * 读取：只有 404（接口不存在 = 星门尚未开放）返回 undefined，调用方据此整体隐藏入口；
 *       其余失败（含断网、超时、5xx）原样抛出，由调用方显示可重试的错误态。
 * 写入：统一返回 {ok,message}，不抛异常；每次调用换新的 command_id。
 */
import {api,ApiFailure} from '../network.ts';
import type {ChartView,TodayView,HubCommissionsView as CommissionsView,HubPortView as PortView} from '../../../../packages/contracts/hub.ts';

export type HubWriteResult = {ok: boolean; message?: string};

/** 接口不存在（404）= 功能未开放，入口整体隐藏。其他状态码一律视为错误。 */
export function isHubNotFound(e: unknown): boolean {
  return e instanceof ApiFailure && e.status === 404;
}

/** 面向玩家的失败文字：断网给固定提示，其余取服务端中文 message，没有就用兜底。 */
export function hubErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiFailure) {
    if (e.status === 0 || e.code === 'NETWORK') return '网络不稳，请检查连接后重试。';
    return e.message || fallback;
  }
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function hubGet<T>(path: string): Promise<T | undefined> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (isHubNotFound(e)) return undefined;
    throw e;
  }
}

export async function hubPost(path: string, body: Record<string, unknown>, fallback: string): Promise<HubWriteResult> {
  try {
    await api(path, {...body, command_id: crypto.randomUUID()});
    return {ok: true};
  } catch (e) {
    return {ok: false, message: hubErrorMessage(e, fallback)};
  }
}

/** GET /api/hub/chart */
export const getHubChart = () => hubGet<ChartView>('hub/chart');
/** GET /api/hub/today */
export const getHubToday = () => hubGet<TodayView>('hub/today');
/** GET /api/hub/commissions */
export const getHubCommissions = () => hubGet<CommissionsView>('hub/commissions');
/** GET /api/hub/port */
export const getHubPort = () => hubGet<PortView>('hub/port');

/** POST /api/hub/sea-tier — 切换海域难度 */
export const postSeaTier = (tier: number) => hubPost('hub/sea-tier', {tier}, '切换海域失败，请重试。');

/** POST /api/hub/return-ack — 确认已播完一条回港队列（非关键路径，失败只丢弃） */
export async function postReturnAck(kind: string, id: string): Promise<void> {
  await hubPost('hub/return-ack', {kind, id}, '');
}

/** POST /api/hub/commissions — claim 或 abandon */
export const postCommission = (op: 'claim' | 'abandon', id: string) =>
  hubPost('hub/commissions', {op, id}, '操作失败，请重试。');

/** POST /api/hub/port/claim — 领取港口建设阶级奖励 */
export const postPortClaim = (building: string, tier: number) =>
  hubPost('hub/port/claim', {building, tier}, '领取失败，请重试。');

/** POST /api/hub/dock — 派遣/领取/快速收益 */
export const postDock = (op: 'send' | 'collect' | 'quick', fleet?: number, region?: string) =>
  hubPost('hub/dock', {op, ...(fleet !== undefined ? {fleet} : {}), ...(region ? {region} : {})}, '码头操作失败，请重试。');

