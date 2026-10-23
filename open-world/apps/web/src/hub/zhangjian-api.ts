/**
 * Z1–Z3 的接口封装（M17 杖剑借鉴）。
 * 404 返回 undefined → 调用方整块隐藏入口；其余错误由 hubPost 返回 {ok:false,message}。
 */
import {hubGet, hubPost} from './hub-api.ts';
import type {LoadoutView, SlotsView, PetsView, RankSlot, PetFlow} from '../../../../packages/contracts/zhangjian.ts';

/** GET /api/loadout — 三个方案摘要 + 当前方案状态 */
export const getLoadout = () => hubGet<LoadoutView>('loadout');
/** GET /api/slots — 六部位强化等级 + 共鸣 */
export const getSlots = () => hubGet<SlotsView>('slots');
/** GET /api/pets — 已拥有宠物 + 阵容 + 图鉴 */
export const getPets = () => hubGet<PetsView>('pets');

/** POST /api/loadout op:save — 保存当前配置到指定方案 */
export const postLoadoutSave = (index: number) =>
  hubPost('loadout', {op: 'save', index}, '保存方案失败，请重试。');

/** POST /api/loadout op:apply — 切换到指定方案（含装备/技能/天赋/宠物） */
export const postLoadoutApply = (index: number) =>
  hubPost('loadout', {op: 'apply', index}, '切换方案失败，请重试。');

/** POST /api/loadout op:rename — 给指定方案改名 */
export const postLoadoutRename = (index: number, name: string) =>
  hubPost('loadout', {op: 'rename', index, name}, '改名失败，请重试。');

/** POST /api/slot/upgrade — 强化指定部位 */
export const postSlotUpgrade = (slot: RankSlot) =>
  hubPost('slot/upgrade', {slot}, '强化失败，请重试。');

/** POST /api/pets op:lineup — 修改上阵/助阵阵容 */
export const postPetLineup = (active: string | null, support: string[]) =>
  hubPost('pets', {op: 'lineup', active, support}, '调整阵容失败，请重试。');

/** POST /api/pets op:flow — 切换宠物流派 */
export const postPetFlow = (family: string, flow: PetFlow) =>
  hubPost('pets', {op: 'flow', family, flow}, '切换流派失败，请重试。');
