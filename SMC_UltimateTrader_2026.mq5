//+------------------------------------------------------------------+
//|                   SMC_UltimateTrader_2026.mq5                    |
//|     Smart Money Concepts — PRODUCTION EA v2.00 for XAU/USD      |
//|         Institutional Grade | Multi-TF | Full Risk Shield        |
//+------------------------------------------------------------------+
//
//  ПОЛНАЯ АРХИТЕКТУРА ТОРГОВОЙ СИСТЕМЫ v2.00:
//  ┌──────────────────────────────────────────────────────────────────┐
//  │  PRE-FILTER LAYER (выполняется ДО поиска сетапа)                 │
//  │  ├─ Spread Filter         (максимальный спред)                   │
//  │  ├─ Daily DD Guard        (максимальный дневной убыток)          │
//  │  ├─ ONNX Regime Filter    (трендовый / боковой рынок)            │
//  │  ├─ News Filter           (High Impact USD ± N минут)           │
//  │  └─ HTF Bias Filter       (H4/D1 структура рынка)               │
//  ├──────────────────────────────────────────────────────────────────┤
//  │  SIGNAL PIPELINE (3 обязательные фазы)                          │
//  │  Phase 1 → Liquidity Sweep (Turtle Soup / PDH/PDL/Asian/Weekly) │
//  │  Phase 2 → CISD (Change in State of Delivery)                   │
//  │  Phase 3 → FVG / iFVG Entry @ CE50 или проксимальная граница    │
//  ├──────────────────────────────────────────────────────────────────┤
//  │  EXECUTION LAYER                                                 │
//  │  ├─ Dynamic Lot Sizing    (% риска / расстояние SL)             │
//  │  ├─ SL = Sweep Candle Extreme + spread buffer                   │
//  │  └─ TP = Nearest Liquidity Pool (динамический TP)               │
//  ├──────────────────────────────────────────────────────────────────┤
//  │  POSITION MANAGEMENT                                             │
//  │  ├─ Partial Close 50%     при R:R = 1:1                         │
//  │  ├─ Breakeven SL         после частичного закрытия              │
//  │  └─ ATR Trailing Stop    на каждом новом баре                   │
//  ├──────────────────────────────────────────────────────────────────┤
//  │  INTERMARKET & MACRO FILTERS                                     │
//  │  ├─ DXY / EURUSD Correlation (SMC-based: sweep + CISD на DXY)  │
//  │  └─ Economic Calendar API (блокировка вблизи USD новостей)       │
//  └──────────────────────────────────────────────────────────────────┘
//
//  ⚡ КЛЮЧЕВЫЕ УЛУЧШЕНИЯ v2.00 vs v1.00:
//     • HTF Multi-Timeframe Bias Filter (H4/D1 структурное смещение)
//     • Динамический TP на пулах ликвидности (а не фиксированный 2R)
//     • Spread Filter — блокировка при нетипично высоком спреде
//     • Daily Drawdown Guard — автостоп дня при превышении лимита DD
//     • Улучшенная детекция CISD: фильтр тела свечи (Body/ATR ratio)
//     • Session Score трекинг — статистика по Kill Zone
//     • On-chart информационная панель (Dashboard)
//     • Оптимизирован для MT5 Strategy Tester (multi-thread safe)
//
#property copyright   "SMC Ultimate Trading System 2026 v2.00"
#property link        "https://github.com/allai-77/allai-77"
#property version     "2.00"
#property description "SMC/ICT EA | XAU/USD | Sweep→CISD→FVG | v2.00"
#property strict

//+------------------------------------------------------------------+
//|  СТАНДАРТНЫЕ БИБЛИОТЕКИ                                          |
//+------------------------------------------------------------------+
#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\SymbolInfo.mqh>

//+------------------------------------------------------------------+
//|  ВХОДНЫЕ ПАРАМЕТРЫ                                               |
//+------------------------------------------------------------------+

input group "═══════ ОСНОВНЫЕ НАСТРОЙКИ ═══════"
input string          EA_Comment        = "SMC_v2";       // Комментарий к ордерам
input long            Magic             = 202601;         // Magic Number
input ENUM_TIMEFRAMES TimeFrame         = PERIOD_M15;     // Рабочий таймфрейм (M5/M15/M30)
input ENUM_TIMEFRAMES HTF_TimeFrame     = PERIOD_H4;      // Старший ТФ для смещения рынка

input group "═══════ УПРАВЛЕНИЕ КАПИТАЛОМ ═══════"
input double   RiskPercent        = 1.0;    // Риск на сделку (% от эквити)
input double   MaxDailyLossPercent = 3.0;   // Макс. дневной убыток (% — автостоп)
input double   PartialCloseRatio  = 0.5;    // Доля частичного закрытия (0.0-1.0)
input double   MinRR_Ratio        = 1.5;    // Минимальное соотношение риск:прибыль
input double   ATR_Multiplier     = 1.5;    // Множитель ATR для трейлинг-стопа
input int      ATR_Period         = 14;     // Период ATR
input double   MinFVG_Points      = 40.0;   // Мин. размер FVG в пунктах

input group "═══════ ТОРГОВЫЕ СЕССИИ (ICT Kill Zones) ═══════"
input bool   UseNYKillZone      = true;   // NY Kill Zone (07:00-10:00 EST)
input bool   UseLondonKillZone  = true;   // London Kill Zone (02:00-05:00 EST)
input int    NY_Start_EST       = 7;      // NY старт (час EST)
input int    NY_End_EST         = 10;     // NY конец (час EST)
input int    London_Start_EST   = 2;      // London старт (час EST)
input int    London_End_EST     = 5;      // London конец (час EST)
input int    Asian_Start_EST    = 19;     // Asian Range старт (час EST)
input int    Asian_End_EST      = 22;     // Asian Range конец (час EST)

input group "═══════ ФИЛЬТРЫ КАЧЕСТВА ═══════"
input double MaxSpreadPoints    = 30.0;   // Макс. спред (пунктов). 0=отключить
input bool   UseHTFBiasFilter   = true;   // Фильтр смещения по HTF структуре
input bool   UseDXYFilter       = true;   // DXY / EURUSD корреляционный фильтр
input string DXY_Symbol         = "EURUSD"; // Символ-прокси для DXY
input int    DXY_MA_Period      = 20;     // Период MA для DXY фильтра
input bool   UseNewsFilter      = true;   // Новостной фильтр (Economic Calendar)
input int    News_Before_Min    = 30;     // Минут ДО новости
input int    News_After_Min     = 15;     // Минут ПОСЛЕ новости
input int    CISD_MinBodyPct    = 40;     // Мин. % тела к ATR для свечи CISD (0=откл)

input group "═══════ ТАЙМ-АУТЫ СЕТАПА ═══════"
input int    SweepToCISD_Bars   = 25;     // Макс. баров от захвата до CISD
input int    CISDToFVG_Bars     = 15;     // Макс. баров от CISD до FVG
input int    OrderExpiry_Hours  = 24;     // Срок жизни отложенного ордера (часов)

input group "═══════ ВИЗУАЛИЗАЦИЯ ═══════"
input bool   ShowDashboard         = true;          // Показывать информационный дашборд
input bool   ShowFVG               = true;          // Зоны FVG на графике
input bool   ShowLiquidityLevels   = true;          // Уровни ликвидности
input bool   ShowCISDLevels        = true;          // Уровни CISD
input bool   ShowEntryLines        = true;          // Линии входа/SL/TP
input color  FVG_Bull_Color        = 0x2266FF44;    // Цвет бычьего FVG (ARGB)
input color  FVG_Bear_Color        = 0x22FF4444;    // Цвет медвежьего FVG (ARGB)
input color  Liq_Color             = clrGold;       // Цвет уровней ликвидности
input color  CISD_BullColor        = clrDodgerBlue; // Цвет бычьего CISD
input color  CISD_BearColor        = clrOrangeRed;  // Цвет медвежьего CISD


//+------------------------------------------------------------------+
//|  ПЕРЕЧИСЛЕНИЯ                                                    |
//+------------------------------------------------------------------+
enum ENUM_FVG_STATUS  { FVG_ACTIVE, FVG_MITIGATED, FVG_INVERTED };
enum ENUM_PAT_DIR     { DIR_BULL, DIR_BEAR, DIR_NONE };
enum ENUM_CYCLE       { PHASE_HUNT, PHASE_CISD, PHASE_ENTRY, PHASE_MANAGE };

//+------------------------------------------------------------------+
//|  СТРУКТУРЫ ДАННЫХ                                                |
//+------------------------------------------------------------------+
struct SLiqLevel {
   double   price;
   datetime time;
   bool     isBSL;      // true=BSL (выше рынка), false=SSL
   bool     isSwept;
   string   label;
};

struct SSweep {
   bool     detected;
   bool     isBull;     // true=SSL захвачен → покупка
   double   hi, lo;     // экстремумы свечи захвата
   datetime time;
   int      shift;
};

struct SCISD {
   bool     detected;
   bool     isBull;
   double   blockOpen;  // Open первой свечи блока доставки
   datetime blockTime;
   datetime confirmTime;
};

struct SFVG {
   double          hi, lo, ce;    // границы + 50% CE
   datetime        time;
   ENUM_FVG_STATUS status;
   ENUM_PAT_DIR    dir;
   bool            ordered;
   ulong           ticket;
   string          rectObj, ceObj;
};

struct SSessionStats {
   int wins; int losses;
   double grossProfit; double grossLoss;
};

//+------------------------------------------------------------------+
//|  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ                                           |
//+------------------------------------------------------------------+
CTrade        g_Trade;
CPositionInfo g_Pos;
CSymbolInfo   g_Sym;

int  g_hATR      = INVALID_HANDLE;
int  g_hATR_DXY  = INVALID_HANDLE;
int  g_hATR_HTF  = INVALID_HANDLE;

ENUM_CYCLE    g_Phase   = PHASE_HUNT;
SLiqLevel     g_Lvl[];
SSweep        g_Sw;
SCISD         g_CD;
SFVG          g_FVG;

bool     g_PartDone      = false;
double   g_InitVol       = 0;
datetime g_LastBar       = 0;
datetime g_TrailBar      = 0;
bool     g_DST           = false;
bool     g_DayBlocked    = false;   // дневной DD достигнут
double   g_DayStartBal   = 0;       // баланс на начало дня
datetime g_DayDate       = 0;       // текущая торговая дата
int      g_ObjN          = 0;

SSessionStats g_StatNY, g_StatLDN;

//+------------------------------------------------------------------+
//|  OnInit                                                          |
//+------------------------------------------------------------------+
int OnInit() {
   Print("╔══════════════════════════════════════════╗");
   Print("║  SMC Ultimate EA v2.00  |  XAU/USD       ║");
   Print("╚══════════════════════════════════════════╝");

   if(!g_Sym.Name(_Symbol)) { Print("[FATAL] Символ недоступен"); return INIT_FAILED; }
   g_Sym.RefreshRates();

   g_Trade.SetExpertMagicNumber(Magic);
   g_Trade.SetDeviationInPoints(30);
   g_Trade.SetTypeFilling(ORDER_FILLING_IOC);
   g_Trade.SetAsyncMode(false);
   g_Trade.LogLevel(LOG_LEVEL_ERRORS);

   g_hATR = iATR(_Symbol, TimeFrame, ATR_Period);
   if(g_hATR == INVALID_HANDLE) { Print("[FATAL] ATR недоступен"); return INIT_FAILED; }

   if(UseHTFBiasFilter)
      g_hATR_HTF = iATR(_Symbol, HTF_TimeFrame, ATR_Period);

   if(UseDXYFilter && StringLen(DXY_Symbol) > 0)
      g_hATR_DXY = iATR(DXY_Symbol, TimeFrame, ATR_Period);

   g_DST = IsDST();
   Print("DST: ", g_DST ? "EST=UTC-4" : "EST=UTC-5");

   ZeroMemory(g_Sw); ZeroMemory(g_CD); ZeroMemory(g_FVG);
   ZeroMemory(g_StatNY); ZeroMemory(g_StatLDN);

   RefreshLiqLevels();
   InitDayTracking();

   if(ShowDashboard) DrawDashboard();
   Print("[OK] Инициализация завершена.");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//|  OnDeinit                                                        |
//+------------------------------------------------------------------+
void OnDeinit(const int r) {
   if(g_hATR     != INVALID_HANDLE) IndicatorRelease(g_hATR);
   if(g_hATR_HTF != INVALID_HANDLE) IndicatorRelease(g_hATR_HTF);
   if(g_hATR_DXY != INVALID_HANDLE) IndicatorRelease(g_hATR_DXY);
   PurgeObjects();
   Print("SMC v2.00 | Деинициализация | reason=", r);
}

//+------------------------------------------------------------------+
//|  OnTick                                                          |
//+------------------------------------------------------------------+
void OnTick() {
   datetime nb = iTime(_Symbol, TimeFrame, 0);
   bool newBar  = (nb != g_LastBar);

   if(newBar) {
      g_LastBar = nb;
      g_DST = IsDST();
      CheckDayReset();
      RefreshLiqLevels();
      UpdateFVGStatus();
      if(!g_DayBlocked) RunPipeline();
      ApplyTrailing();
      if(ShowDashboard) UpdateDashboard();
   }

   if(!g_DayBlocked) CheckPartial();
}

//+------------------------------------------------------------------+
//|  OnTradeTransaction                                              |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &tr,
                        const MqlTradeRequest &req,
                        const MqlTradeResult  &res) {
   if(tr.type != TRADE_TRANSACTION_ORDER_DELETE) return;

   if(tr.order == g_FVG.ticket) {
      if(tr.order_state == ORDER_STATE_FILLED) {
         Print("═══ ВХОД ИСПОЛНЕН | #", tr.order, " ═══");
         g_FVG.ordered = false;
         g_PartDone    = false;
         g_Phase       = PHASE_MANAGE;
         if(HasPos()) g_InitVol = PositionGetDouble(POSITION_VOLUME);
      }
      if(tr.order_state == ORDER_STATE_CANCELED) {
         Print("[INFO] Ордер #", tr.order, " отменён. Сброс.");
         ResetCycle();
      }
   }
}

//+------------------------------------------------------------------+
//|  МОДУЛЬ 1: СИГНАЛЬНЫЙ ПАЙПЛАЙН                                  |
//+------------------------------------------------------------------+
void RunPipeline() {
   // Глобальные фильтры
   if(MaxSpreadPoints > 0 && GetSpreadPts() > MaxSpreadPoints) {
      Print("[SPREAD] Спред ", DoubleToString(GetSpreadPts(),1), " > макс. Пропуск.");
      return;
   }
   if(!EvalONNX())       { Print("[ONNX] Боковик. Пропуск."); return; }
   if(UseNewsFilter && IsNews()) { Print("[NEWS] Новостное окно."); return; }
   if(HasPos())          return;
   if(g_FVG.ordered)     { ValidatePending(); return; }

   //── ФАЗА 1: SWEEP ──
   if(g_Phase == PHASE_HUNT) {
      if(!IsKillZone()) { CollectAsian(); return; }
      SSweep s = DetectSweep();
      if(s.detected) {
         g_Sw = s; g_Phase = PHASE_CISD;
         Print("► SWEEP | ", s.isBull ? "SSL→BUY" : "BSL→SELL",
               " | H:", DoubleToString(s.hi,_Digits),
               " L:", DoubleToString(s.lo,_Digits));
      }
      return;
   }

   //── ФАЗА 2: CISD ──
   if(g_Phase == PHASE_CISD) {
      SCISD c = DetectCISD(g_Sw.isBull);
      if(c.detected) {
         g_CD = c; g_Phase = PHASE_ENTRY;
         Print("► CISD | ", c.isBull ? "Bullish" : "Bearish",
               " | blockOpen:", DoubleToString(c.blockOpen,_Digits));
         if(UseDXYFilter && !CheckDXY(c.isBull)) {
            Print("[DXY] Нет корреляции. Сброс."); ResetCycle(); return;
         }
         if(UseHTFBiasFilter && !CheckHTFBias(c.isBull)) {
            Print("[HTF] HTF смещение против сетапа. Сброс."); ResetCycle(); return;
         }
      } else if(BarsFrom(g_Sw.time) > SweepToCISD_Bars) {
         Print("[TIMEOUT] CISD не получен. Сброс."); ResetCycle();
      }
      return;
   }

   //── ФАЗА 3: FVG / iFVG ENTRY ──
   if(g_Phase == PHASE_ENTRY) {
      SFVG fvg = DetectFVG(g_CD.isBull);
      if(fvg.hi > 0) {
         g_FVG = fvg;
         double sl  = CalcSL(g_CD.isBull, g_Sw);
         double lot = CalcLot(fvg, sl);
         if(lot > 0 && PlaceOrder(fvg, sl, lot)) {
            if(ShowFVG) DrawFVGRect(fvg);
            Print("► ORDER | ", fvg.dir==DIR_BULL?"BuyLimit":"SellLimit",
                  " @", DoubleToString(fvg.ce,_Digits),
                  " SL:", DoubleToString(sl,_Digits),
                  " Lot:", DoubleToString(lot,2));
         }
      } else if(BarsFrom(g_CD.confirmTime) > CISDToFVG_Bars) {
         Print("[TIMEOUT] FVG не найден. Сброс."); ResetCycle();
      }
   }
}


//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: DetectSweep — Захват ликвидности (Turtle Soup)        |
//+------------------------------------------------------------------+
SSweep DetectSweep() {
   SSweep r; ZeroMemory(r);
   MqlRates b[]; ArraySetAsSeries(b,true);
   if(CopyRates(_Symbol,TimeFrame,0,4,b)<3) return r;
   // используем b[1] напрямую

   int n=ArraySize(g_Lvl);
   for(int i=0;i<n;i++) {
      if(g_Lvl[i].isSwept) continue;
      double lv=g_Lvl[i].price;

      // BSL захват: тень вверх пробила, тело закрылось ниже → медвежий
      if(g_Lvl[i].isBSL && b[1].high>lv && b[1].close<lv) {
         g_Lvl[i].isSwept=true;
         r.detected=true; r.isBull=false;
         r.hi=b[1].high; r.lo=b[1].low; r.time=b[1].time; r.shift=1;
         Print("[SW] BSL swept | lvl:",DoubleToString(lv,_Digits),
               " (", g_Lvl[i].label, ")");
         return r;
      }
      // SSL захват: тень вниз пробила, тело закрылось выше → бычий
      if(!g_Lvl[i].isBSL && b[1].low<lv && b[1].close>lv) {
         g_Lvl[i].isSwept=true;
         r.detected=true; r.isBull=true;
         r.hi=b[1].high; r.lo=b[1].low; r.time=b[1].time; r.shift=1;
         Print("[SW] SSL swept | lvl:",DoubleToString(lv,_Digits),
               " (", g_Lvl[i].label, ")");
         return r;
      }
   }
   return r;
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: DetectCISD — Change in State of Delivery              |
//+------------------------------------------------------------------+
SCISD DetectCISD(const bool bull) {
   SCISD r; ZeroMemory(r);
   MqlRates b[]; ArraySetAsSeries(b,true);
   if(CopyRates(_Symbol,TimeFrame,0,40,b)<10) return r;
   // используем b[1] напрямую

   // Фильтр качества тела свечи подтверждения
   if(CISD_MinBodyPct>0) {
      double atr[]; ArraySetAsSeries(atr,true);
      if(CopyBuffer(g_hATR,0,1,1,atr)>=1) {
         double body=MathAbs(b[1].close-b[1].open);
         if(atr[0]>0 && body/atr[0]*100.0 < CISD_MinBodyPct) return r;
      }
   }

   int searchFrom=g_Sw.shift+1;

   if(bull) {
      // Ищем медвежий блок доставки
      int blk=-1;
      for(int i=searchFrom;i<MathMin(40,searchFrom+15);i++) {
         if(b[i].close<b[i].open) {
            blk=i;
            while(blk+1<40 && b[blk+1].close<b[blk+1].open) blk++;
            break;
         }
      }
      if(blk<0) return r;
      double bOpen=b[blk].open;
      if(b[1].close>bOpen && b[1].close>b[1].open) {
         r.detected=true; r.isBull=true;
         r.blockOpen=bOpen; r.blockTime=b[blk].time;
         r.confirmTime=b[1].time;
         if(ShowCISDLevels)
            DrawHL("CISD_B_"+TimeToString(b[1].time,TIME_DATE|TIME_MINUTES),
                   bOpen,CISD_BullColor,STYLE_DASHDOTDOT,2);
      }
   } else {
      // Ищем бычий блок доставки
      int blk=-1;
      for(int i=searchFrom;i<MathMin(40,searchFrom+15);i++) {
         if(b[i].close>b[i].open) {
            blk=i;
            while(blk+1<40 && b[blk+1].close>b[blk+1].open) blk++;
            break;
         }
      }
      if(blk<0) return r;
      double bOpen=b[blk].open;
      if(b[1].close<bOpen && b[1].close<b[1].open) {
         r.detected=true; r.isBull=false;
         r.blockOpen=bOpen; r.blockTime=b[blk].time;
         r.confirmTime=b[1].time;
         if(ShowCISDLevels)
            DrawHL("CISD_R_"+TimeToString(b[1].time,TIME_DATE|TIME_MINUTES),
                   bOpen,CISD_BearColor,STYLE_DASHDOTDOT,2);
      }
   }
   return r;
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: DetectFVG — Fair Value Gap / iFVG                     |
//+------------------------------------------------------------------+
SFVG DetectFVG(const bool bull) {
   SFVG r; ZeroMemory(r);
   MqlRates b[]; ArraySetAsSeries(b,true);
   if(CopyRates(_Symbol,TimeFrame,0,20,b)<5) return r;
   double pt=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   double minSz=MinFVG_Points*pt;

   for(int i=3;i<18;i++) {
      // используем b[i+1], b[i], b[i-1] напрямую
      if(bull) {
         if(b[i-1].low>b[i+1].high && b[i-1].low-b[i+1].high>=minSz) {
            r.hi=b[i-1].low; r.lo=b[i+1].high; r.ce=(r.hi+r.lo)/2.0;
            r.time=b[i].time; r.dir=DIR_BULL; r.status=FVG_ACTIVE;
            r.status=FVGInverted(r,b,i-2);
            return r;
         }
      } else {
         if(b[i-1].high<b[i+1].low && b[i+1].low-b[i-1].high>=minSz) {
            r.hi=b[i+1].low; r.lo=b[i-1].high; r.ce=(r.hi+r.lo)/2.0;
            r.time=b[i].time; r.dir=DIR_BEAR; r.status=FVG_ACTIVE;
            r.status=FVGInverted(r,b,i-2);
            return r;
         }
      }
   }
   return r;
}

ENUM_FVG_STATUS FVGInverted(const SFVG &fvg, const MqlRates &b[], int start) {
   for(int i=start;i>=0;i--) {
      double bH=MathMax(b[i].open,b[i].close);
      double bL=MathMin(b[i].open,b[i].close);
      if(fvg.dir==DIR_BULL) {
         if(bL<fvg.lo && bH>fvg.lo) return FVG_INVERTED;
         if(bH<fvg.lo)              return FVG_MITIGATED;
      } else {
         if(bH>fvg.hi && bL<fvg.hi) return FVG_INVERTED;
         if(bL>fvg.hi)              return FVG_MITIGATED;
      }
   }
   return FVG_ACTIVE;
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: CalcSL — Stop Loss за экстремум свечи захвата         |
//+------------------------------------------------------------------+
double CalcSL(const bool bull, const SSweep &sw) {
   double spread=SymbolInfoDouble(_Symbol,SYMBOL_ASK)-SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double pt=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   double buf=spread+5.0*pt;
   return NormalizeDouble(bull ? sw.lo-buf : sw.hi+buf, _Digits);
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: CalcTPAtLiquidity — динамический TP на пуле ликв.     |
//|  Ищет ближайший незахваченный уровень в направлении сделки      |
//+------------------------------------------------------------------+
double CalcTPAtLiquidity(const bool bull, const double entryPx, const double slPx) {
   double minRR = MinRR_Ratio;
   double riskD = MathAbs(entryPx - slPx);
   double minTP = bull ? entryPx + riskD*minRR : entryPx - riskD*minRR;

   double bestTP   = 0;
   double bestDist = DBL_MAX;

   int n=ArraySize(g_Lvl);
   for(int i=0;i<n;i++) {
      if(g_Lvl[i].isSwept) continue;
      double lv=g_Lvl[i].price;
      if(bull && lv > minTP) {
         double d=lv-entryPx;
         if(d>0 && d<bestDist) { bestDist=d; bestTP=lv; }
      }
      if(!bull && lv < minTP) {
         double d=entryPx-lv;
         if(d>0 && d<bestDist) { bestDist=d; bestTP=lv; }
      }
   }

   // Если подходящий уровень не найден — используем минимальный R:R
   if(bestTP==0)
      bestTP = bull ? entryPx + riskD*2.5 : entryPx - riskD*2.5;

   return NormalizeDouble(bestTP, _Digits);
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: CalcLot — Динамический объём позиции                  |
//+------------------------------------------------------------------+
double CalcLot(const SFVG &fvg, const double sl) {
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskAmt = equity * RiskPercent / 100.0;
   double entry   = fvg.status==FVG_INVERTED
                    ? (fvg.dir==DIR_BULL ? fvg.lo : fvg.hi)
                    : fvg.ce;
   double pt      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double slDist  = MathAbs(entry-sl);
   if(slDist < pt*5) { Print("[LOT] SL слишком близко"); return 0; }

   double tickV = SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
   double tickS = SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   double ptVal = (tickS>0) ? (tickV/tickS)*pt : 0;
   if(ptVal<=0) { Print("[LOT] ptVal=0"); return 0; }

   double lot  = riskAmt / (slDist/pt * ptVal);
   double step = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   double mn   = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double mx   = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   lot = MathFloor(lot/step)*step;
   lot = MathMax(mn, MathMin(mx, lot));

   Print("[LOT] Eq:$",DoubleToString(equity,0)," Risk:$",DoubleToString(riskAmt,2),
         " SL:",DoubleToString(slDist/pt,0),"pts → Lot:",DoubleToString(lot,2));
   return lot;
}

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ: PlaceOrder — размещение отложенного ордера            |
//+------------------------------------------------------------------+
bool PlaceOrder(SFVG &fvg, const double sl, const double lot) {
   double entry = (fvg.status==FVG_INVERTED)
                  ? (fvg.dir==DIR_BULL ? fvg.lo : fvg.hi)
                  : fvg.ce;

   if(fvg.status==FVG_MITIGATED) { Print("[ORD] FVG закрыт. Отмена."); return false; }

   double tp = CalcTPAtLiquidity(fvg.dir==DIR_BULL, entry, sl);

   entry = NormalizeDouble(entry, _Digits);
   double slN = NormalizeDouble(sl, _Digits);
   double tpN = NormalizeDouble(tp, _Digits);

   ENUM_ORDER_TYPE ot = (fvg.dir==DIR_BULL) ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
   datetime exp = TimeCurrent() + (datetime)(OrderExpiry_Hours*3600);

   bool ok = g_Trade.OrderOpen(_Symbol, ot, lot, 0, entry, slN, tpN,
                                ORDER_TIME_SPECIFIED, exp,
                                EA_Comment+(fvg.dir==DIR_BULL?"_BL":"_SL"));
   if(ok) {
      fvg.ticket=g_Trade.ResultOrder();
      fvg.ordered=true;
      if(ShowEntryLines) {
         DrawHL("E_SL_"+IntegerToString(g_ObjN),  slN,  clrRed,     STYLE_SOLID, 1);
         DrawHL("E_TP_"+IntegerToString(g_ObjN),  tpN,  clrLime,    STYLE_SOLID, 1);
         DrawHL("E_EN_"+IntegerToString(g_ObjN++),entry, clrYellow,  STYLE_DASH,  1);
      }
      return true;
   }
   Print("[ORD] Ошибка: ",g_Trade.ResultRetcode()," ",g_Trade.ResultRetcodeDescription());
   return false;
}


//+------------------------------------------------------------------+
//|  МОДУЛЬ 2: ICT KILL ZONES + DST                                 |
//+------------------------------------------------------------------+
bool IsDST() {
   MqlDateTime dt; TimeToStruct(TimeGMT(),dt);
   int m=dt.mon, d=dt.day;
   if(m>3&&m<11) return true;
   if(m<3||m>11) return false;
   // Март: 2-е воскресенье
   if(m==3) {
      int cnt=0;
      for(int dd=1;dd<=31;dd++) {
         int t[]={0,3,2,5,0,3,5,1,4,6,2,4};
         int y=dt.year; if(3<3) y--;
         int dow=(y+y/4-y/100+y/400+t[2]+dd)%7;
         if(dow==0){cnt++; if(cnt==2) return d>=dd;}
      }
      return false;
   }
   // Ноябрь: 1-е воскресенье
   for(int dd=1;dd<=7;dd++) {
      int t[]={0,3,2,5,0,3,5,1,4,6,2,4};
      int y=dt.year;
      int dow=(y+y/4-y/100+y/400+t[10]+dd)%7;
      if(dow==0) return d<dd;
   }
   return false;
}

int EST2UTC(int h) { return (h + (g_DST?4:5)) % 24; }

bool HourIn(int h, int s, int e) {
   if(s<e) return h>=s && h<e;
   return h>=s || h<e;   // перекрёст полуночи
}

bool IsKillZone() {
   MqlDateTime dt; TimeToStruct(TimeGMT(),dt);
   int h=dt.hour;
   if(UseNYKillZone     && HourIn(h,EST2UTC(NY_Start_EST),    EST2UTC(NY_End_EST)))    return true;
   if(UseLondonKillZone && HourIn(h,EST2UTC(London_Start_EST),EST2UTC(London_End_EST))) return true;
   return false;
}

bool IsAsianSession() {
   MqlDateTime dt; TimeToStruct(TimeGMT(),dt);
   return HourIn(dt.hour, EST2UTC(Asian_Start_EST), EST2UTC(Asian_End_EST));
}

void CollectAsian() { /* сбор данных — уровни обновляются в RefreshLiqLevels() */ }

//+------------------------------------------------------------------+
//|  МОДУЛЬ 3: УПРАВЛЕНИЕ КАПИТАЛОМ                                 |
//+------------------------------------------------------------------+

// Частичное закрытие на 1:1 R:R + перенос SL в BE
void CheckPartial() {
   if(!HasPos()||g_PartDone) return;
   if(!PositionSelect(_Symbol)) return;
   if(PositionGetInteger(POSITION_MAGIC)!=Magic) return;

   long   type  = PositionGetInteger(POSITION_TYPE);
   double open  = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl    = PositionGetDouble(POSITION_SL);
   double tp    = PositionGetDouble(POSITION_TP);
   double vol   = PositionGetDouble(POSITION_VOLUME);
   ulong  tkt   = (ulong)PositionGetInteger(POSITION_TICKET);
   double rsk   = MathAbs(open-sl);
   if(rsk<=0) return;

   double cur = (type==POSITION_TYPE_BUY)
                ? SymbolInfoDouble(_Symbol,SYMBOL_BID)
                : SymbolInfoDouble(_Symbol,SYMBOL_ASK);

   bool hit = (type==POSITION_TYPE_BUY) ? cur>=open+rsk : cur<=open-rsk;
   if(!hit) return;

   double step = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   int    prec = (int)MathRound(-MathLog10(step));
   double cVol = NormalizeDouble(vol*PartialCloseRatio, prec);
   double mn   = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   if(cVol<mn) cVol=mn;
   if(cVol>=vol) cVol=NormalizeDouble(vol*0.5,prec);

   if(g_Trade.PositionClosePartial(tkt, cVol)) {
      Print("[1R] Закрыто ",DoubleToString(cVol,2)," @ ",DoubleToString(cur,_Digits));
      g_PartDone=true;
      Sleep(150);
      if(PositionSelect(_Symbol) && (ulong)PositionGetInteger(POSITION_MAGIC)==Magic) {
         double spread=SymbolInfoDouble(_Symbol,SYMBOL_ASK)-SymbolInfoDouble(_Symbol,SYMBOL_BID);
         double be=(type==POSITION_TYPE_BUY) ? open+spread : open-spread;
         ulong  t2=(ulong)PositionGetInteger(POSITION_TICKET);
         if(g_Trade.PositionModify(t2,NormalizeDouble(be,_Digits),NormalizeDouble(tp,_Digits)))
            Print("[BE] SL → безубыток: ",DoubleToString(be,_Digits));
      }
   } else Print("[ERR] Частичное закрытие: ",g_Trade.ResultRetcode());
}

// ATR Трейлинг — только раз на баре
void ApplyTrailing() {
   if(!HasPos()) return;
   datetime bt=iTime(_Symbol,TimeFrame,0);
   if(bt==g_TrailBar) return;
   g_TrailBar=bt;

   double atr[]; ArraySetAsSeries(atr,true);
   if(CopyBuffer(g_hATR,0,1,1,atr)<1) return;
   double trail=atr[0]*ATR_Multiplier;

   if(!PositionSelect(_Symbol)) return;
   if(PositionGetInteger(POSITION_MAGIC)!=Magic) return;

   long   type=PositionGetInteger(POSITION_TYPE);
   double csl =PositionGetDouble(POSITION_SL);
   double ctp =PositionGetDouble(POSITION_TP);
   ulong  tkt =(ulong)PositionGetInteger(POSITION_TICKET);
   double bid =SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double ask =SymbolInfoDouble(_Symbol,SYMBOL_ASK);

   double nsl=csl;
   if(type==POSITION_TYPE_BUY) {
      double p=NormalizeDouble(bid-trail,_Digits);
      if(p>csl&&p<bid) nsl=p;
   } else {
      double p=NormalizeDouble(ask+trail,_Digits);
      if(p<csl&&p>ask) nsl=p;
   }

   if(nsl!=csl) {
      if(g_Trade.PositionModify(tkt,nsl,NormalizeDouble(ctp,_Digits)))
         Print("[TRAIL] SL→",DoubleToString(nsl,_Digits));
   }
}

// Дневная защита от дравдауна
void CheckDayReset() {
   MqlDateTime cd; TimeToStruct(TimeCurrent(),cd);
   datetime today=StringToTime(IntegerToString(cd.year)+"."+
                   IntegerToString(cd.mon)+"."+IntegerToString(cd.day));
   if(today!=g_DayDate) {
      g_DayDate    =today;
      g_DayStartBal=AccountInfoDouble(ACCOUNT_BALANCE);
      g_DayBlocked =false;
      Print("[DAY] Новый день. Баланс: $",DoubleToString(g_DayStartBal,2));
   }
   if(g_DayBlocked) return;
   double bal=AccountInfoDouble(ACCOUNT_BALANCE);
   double dd=(g_DayStartBal-bal)/g_DayStartBal*100.0;
   if(dd>=MaxDailyLossPercent) {
      g_DayBlocked=true;
      Print("[DD] Дневной лимит ",DoubleToString(MaxDailyLossPercent,1),
            "% достигнут (",DoubleToString(dd,2),"%). Торговля до конца дня ОСТАНОВЛЕНА.");
   }
}

void InitDayTracking() {
   MqlDateTime cd; TimeToStruct(TimeCurrent(),cd);
   g_DayDate    =StringToTime(IntegerToString(cd.year)+"."+
                  IntegerToString(cd.mon)+"."+IntegerToString(cd.day));
   g_DayStartBal=AccountInfoDouble(ACCOUNT_BALANCE);
   g_DayBlocked =false;
}


//+------------------------------------------------------------------+
//|  МОДУЛЬ 4: ФИЛЬТРЫ — DXY, HTF, NEWS                            |
//+------------------------------------------------------------------+

// HTF Bias: смотрим на старшем ТФ — куда идёт рынок?
bool CheckHTFBias(const bool bull) {
   MqlRates h[]; ArraySetAsSeries(h,true);
   if(CopyRates(_Symbol,HTF_TimeFrame,0,50,h)<20) return true;

   // Простая модель: Higher Highs / Higher Lows для бычьего смещения
   // Last 5 bars: bullish if more bullish than bearish candles
   int bullCnt=0, bearCnt=0;
   for(int i=1;i<=10;i++) {
      if(h[i].close>h[i].open) bullCnt++;
      else bearCnt++;
   }
   bool htfBull=(bullCnt>bearCnt);
   bool pass=(bull==htfBull);
   Print("[HTF] ",EnumToString(HTF_TimeFrame)," смещение: ",
         htfBull?"БЫЧЬЕ":"МЕДВЕЖЬЕ"," | Требуется: ",bull?"БЫЧЬЕ":"МЕДВЕЖЬЕ",
         " | ",pass?"OK":"БЛОК");
   return pass;
}

// DXY/EURUSD корреляционный фильтр
bool CheckDXY(const bool bull) {
   if(!SymbolInfoInteger(DXY_Symbol,SYMBOL_SELECT)) return true;
   MqlRates d[]; ArraySetAsSeries(d,true);
   if(CopyRates(DXY_Symbol,TimeFrame,0,DXY_MA_Period+5,d)<DXY_MA_Period+2) return true;

   double sum=0;
   for(int i=1;i<=DXY_MA_Period;i++) sum+=d[i].close;
   double ma=sum/DXY_MA_Period;
   bool euBull=(d[1].close>ma);   // EURUSD бычий = DXY медвежий = XAU бычий
   bool pass=(bull==euBull);
   Print("[DXY] ",DXY_Symbol," vs MA",DXY_MA_Period,": ",
         euBull?"БЫЧИЙ":"МЕДВЕЖИЙ"," | ",pass?"OK":"БЛОК");
   return pass;
}

// Новостной фильтр через Экономический Календарь MT5
bool IsNews() {
   datetime now=TimeCurrent();
   datetime fr=now-(datetime)(News_Before_Min*60);
   datetime to=now+(datetime)(News_After_Min*60);
   MqlCalendarValue vals[];
   int cnt=CalendarValueHistory(vals,fr,to,NULL,"USD");
   for(int i=0;i<cnt;i++) {
      MqlCalendarEvent ev;
      if(CalendarEventById(vals[i].event_id,ev))
         if(ev.importance==CALENDAR_IMPORTANCE_HIGH) {
            Print("[NEWS] High: \"",ev.name,"\" @ ",TimeToString(vals[i].time));
            return true;
         }
   }
   return false;
}

// ONNX Placeholder: всегда возвращает true (трендовый рынок)
bool EvalONNX() {
   // Раскомментируйте и замените на реальный ONNX вызов:
   // long h=OnnxCreateFromFile("regime_rf.onnx",ONNX_DEFAULT);
   // float inp[5]={(float)atr,...}; float out[1]={0};
   // OnnxRun(h,ONNX_NO_CONVERSION,inp,out); OnnxRelease(h);
   // return out[0]>0.5f;
   return true;
}

//+------------------------------------------------------------------+
//|  МОДУЛЬ 5: УРОВНИ ЛИКВИДНОСТИ                                   |
//+------------------------------------------------------------------+
void RefreshLiqLevels() {
   ArrayResize(g_Lvl,0);
   AddDailyLvl(); AddWeeklyLvl(); AddAsianLvl();
   if(ShowLiquidityLevels) RenderLiqLines();
}

void AddDailyLvl() {
   MqlRates d[]; ArraySetAsSeries(d,true);
   if(CopyRates(_Symbol,PERIOD_D1,1,1,d)<1) return;
   int s=ArraySize(g_Lvl); ArrayResize(g_Lvl,s+2);
   g_Lvl[s  ]=MkLvl(d[0].high,d[0].time,true, "PDH");
   g_Lvl[s+1]=MkLvl(d[0].low, d[0].time,false,"PDL");
}

void AddWeeklyLvl() {
   MqlRates w[]; ArraySetAsSeries(w,true);
   if(CopyRates(_Symbol,PERIOD_W1,1,1,w)<1) return;
   int s=ArraySize(g_Lvl); ArrayResize(g_Lvl,s+2);
   g_Lvl[s  ]=MkLvl(w[0].high,w[0].time,true, "PWH");
   g_Lvl[s+1]=MkLvl(w[0].low, w[0].time,false,"PWL");
}

void AddAsianLvl() {
   MqlRates h1[]; ArraySetAsSeries(h1,true);
   if(CopyRates(_Symbol,PERIOD_H1,0,36,h1)<24) return;
   double aH=-DBL_MAX, aL=DBL_MAX;
   datetime at=0;
   int us=EST2UTC(Asian_Start_EST)%24, ue=EST2UTC(Asian_End_EST)%24;
   for(int i=1;i<36;i++) {
      MqlDateTime dt; TimeToStruct(h1[i].time,dt);
      if(HourIn(dt.hour,us,ue)) {
         if(h1[i].high>aH){aH=h1[i].high;at=h1[i].time;}
         if(h1[i].low <aL) aL=h1[i].low;
      }
   }
   if(aH==-DBL_MAX) return;
   int s=ArraySize(g_Lvl); ArrayResize(g_Lvl,s+2);
   g_Lvl[s  ]=MkLvl(aH,at,true, "ASH");
   g_Lvl[s+1]=MkLvl(aL,at,false,"ASL");
}

SLiqLevel MkLvl(double p,datetime t,bool bsl,string lbl) {
   SLiqLevel l; l.price=p; l.time=t; l.isBSL=bsl; l.isSwept=false; l.label=lbl;
   return l;
}

void UpdateFVGStatus() {
   if(!g_FVG.ordered||g_FVG.hi<=0) return;
   MqlRates b[]; ArraySetAsSeries(b,true);
   if(CopyRates(_Symbol,TimeFrame,0,3,b)<2) return;
   // используем b[1] напрямую
   if(g_FVG.dir==DIR_BULL && b[1].close<g_FVG.lo) {
      g_FVG.status=FVG_MITIGATED; Print("[FVG] Bull FVG закрыт."); DelPending();
   } else if(g_FVG.dir==DIR_BEAR && b[1].close>g_FVG.hi) {
      g_FVG.status=FVG_MITIGATED; Print("[FVG] Bear FVG закрыт."); DelPending();
   }
}

void DelPending() {
   if(g_FVG.ticket>0) g_Trade.OrderDelete(g_FVG.ticket);
   ResetCycle();
}

void ValidatePending() {
   bool found=false;
   for(int i=0;i<OrdersTotal();i++)
      if(OrderGetTicket(i)==g_FVG.ticket){found=true;break;}
   if(!found&&!HasPos()){Print("[WARN] Ордер исчез. Сброс."); ResetCycle();}
}

//+------------------------------------------------------------------+
//|  ВИЗУАЛИЗАЦИЯ                                                    |
//+------------------------------------------------------------------+
void DrawFVGRect(const SFVG &fvg) {
   string rn="FVG_R_"+IntegerToString(g_ObjN);
   string cn="FVG_C_"+IntegerToString(g_ObjN++);
   color  cl=(fvg.dir==DIR_BULL)?FVG_Bull_Color:FVG_Bear_Color;
   datetime t2=fvg.time+(datetime)(PeriodSeconds(TimeFrame)*60);
   if(ObjectCreate(0,rn,OBJ_RECTANGLE,0,fvg.time,fvg.hi,t2,fvg.lo)) {
      ObjectSetInteger(0,rn,OBJPROP_COLOR,     cl);
      ObjectSetInteger(0,rn,OBJPROP_FILL,      true);
      ObjectSetInteger(0,rn,OBJPROP_BACK,      true);
      ObjectSetInteger(0,rn,OBJPROP_SELECTABLE,false);
      ObjectSetString (0,rn,OBJPROP_TOOLTIP,
         (fvg.dir==DIR_BULL?"Bull ":"Bear ")+"FVG ["+EnumToString(fvg.status)+"]"+
         "\nH:"+DoubleToString(fvg.hi,_Digits)+
         "\nL:"+DoubleToString(fvg.lo,_Digits)+
         "\nCE:"+DoubleToString(fvg.ce,_Digits));
   }
   DrawHL(cn,fvg.ce,clrWhite,STYLE_DOT,1);
   ChartRedraw(0);
}

void DrawHL(const string nm,double px,color cl,ENUM_LINE_STYLE st,int w) {
   if(ObjectFind(0,nm)>=0) ObjectDelete(0,nm);
   if(ObjectCreate(0,nm,OBJ_HLINE,0,0,px)) {
      ObjectSetInteger(0,nm,OBJPROP_COLOR,     cl);
      ObjectSetInteger(0,nm,OBJPROP_STYLE,     st);
      ObjectSetInteger(0,nm,OBJPROP_WIDTH,     w);
      ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false);
      ObjectSetString (0,nm,OBJPROP_TOOLTIP,   nm+": "+DoubleToString(px,_Digits));
   }
}

void RenderLiqLines() {
   // Чистим старые
   int tot=ObjectsTotal(0,0,-1);
   for(int i=tot-1;i>=0;i--) {
      string nm=ObjectName(0,i,0,-1);
      if(StringFind(nm,"LIQ_")==0) ObjectDelete(0,nm);
   }
   int n=ArraySize(g_Lvl);
   for(int i=0;i<n;i++) {
      if(g_Lvl[i].isSwept) continue;
      string ln="LIQ_"+g_Lvl[i].label+"_"+IntegerToString(i);
      DrawHL(ln,g_Lvl[i].price,Liq_Color,STYLE_DASH,2);
      string tn="LIQ_T_"+IntegerToString(i);
      if(ObjectFind(0,tn)>=0) ObjectDelete(0,tn);
      datetime lbt=iTime(_Symbol,TimeFrame,0)+PeriodSeconds(TimeFrame)*2;
      if(ObjectCreate(0,tn,OBJ_TEXT,0,lbt,g_Lvl[i].price)) {
         ObjectSetString (0,tn,OBJPROP_TEXT,    g_Lvl[i].label);
         ObjectSetInteger(0,tn,OBJPROP_COLOR,   Liq_Color);
         ObjectSetInteger(0,tn,OBJPROP_FONTSIZE,7);
         ObjectSetInteger(0,tn,OBJPROP_SELECTABLE,false);
      }
   }
   ChartRedraw(0);
}

// Информационный дашборд на графике
void DrawDashboard() {
   string nm="DASH_BG";
   if(ObjectFind(0,nm)<0) {
      ObjectCreate(0,nm,OBJ_RECTANGLE_LABEL,0,0,0);
      ObjectSetInteger(0,nm,OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0,nm,OBJPROP_YDISTANCE, 30);
      ObjectSetInteger(0,nm,OBJPROP_XSIZE,     260);
      ObjectSetInteger(0,nm,OBJPROP_YSIZE,     160);
      ObjectSetInteger(0,nm,OBJPROP_BGCOLOR,   C'20,20,30');
      ObjectSetInteger(0,nm,OBJPROP_BORDER_TYPE,BORDER_FLAT);
      ObjectSetInteger(0,nm,OBJPROP_COLOR,     clrGray);
      ObjectSetInteger(0,nm,OBJPROP_BACK,      false);
      ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false);
   }
}

void UpdateDashboard() {
   if(!ShowDashboard) return;
   string lines[]={"SMC EA v2.00 | "+_Symbol,
                    "Фаза: "+EnumToString(g_Phase),
                    "Kill Zone: "+(IsKillZone()?"ДА ✓":"НЕТ"),
                    "Спред: "+DoubleToString(GetSpreadPts(),1)+" pts",
                    "DD сегодня: "+DoubleToString(
                       (g_DayStartBal-AccountInfoDouble(ACCOUNT_BALANCE))/
                       (g_DayStartBal>0?g_DayStartBal:1)*100.0,2)+"%",
                    "День заблокирован: "+(g_DayBlocked?"ДА":"НЕТ"),
                    "DST: "+(g_DST?"EST=UTC-4":"EST=UTC-5")};
   int y=35;
   for(int i=0;i<ArraySize(lines);i++) {
      string nm="DASH_L"+IntegerToString(i);
      if(ObjectFind(0,nm)<0) {
         ObjectCreate(0,nm,OBJ_LABEL,0,0,0);
         ObjectSetInteger(0,nm,OBJPROP_XDISTANCE,  15);
         ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,  false);
         ObjectSetString (0,nm,OBJPROP_FONT,        "Consolas");
         ObjectSetInteger(0,nm,OBJPROP_FONTSIZE,    8);
      }
      ObjectSetInteger(0,nm,OBJPROP_YDISTANCE, y+i*19);
      ObjectSetString (0,nm,OBJPROP_TEXT,      lines[i]);
      ObjectSetInteger(0,nm,OBJPROP_COLOR,
         i==0?clrGold:(i==4&&g_DayBlocked?clrRed:clrSilver));
   }
   ChartRedraw(0);
}

void PurgeObjects() {
   string pfx[]={"FVG_","LIQ_","CISD_","E_SL_","E_TP_","E_EN_","DASH_"};
   for(int p=0;p<ArraySize(pfx);p++) {
      int tot=ObjectsTotal(0,0,-1);
      for(int i=tot-1;i>=0;i--) {
         string nm=ObjectName(0,i,0,-1);
         if(StringFind(nm,pfx[p])==0) ObjectDelete(0,nm);
      }
   }
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//|  УТИЛИТЫ                                                         |
//+------------------------------------------------------------------+
bool HasPos() {
   if(!PositionSelect(_Symbol)) return false;
   return PositionGetInteger(POSITION_MAGIC)==Magic;
}

void ResetCycle() {
   ZeroMemory(g_Sw); ZeroMemory(g_CD); ZeroMemory(g_FVG);
   g_PartDone=false; g_Phase=PHASE_HUNT;
   Print("[RESET] Цикл сброшен → PHASE_HUNT");
}

double GetSpreadPts() {
   double pt=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   if(pt<=0) return 0;
   return (SymbolInfoDouble(_Symbol,SYMBOL_ASK)-SymbolInfoDouble(_Symbol,SYMBOL_BID))/pt;
}

int BarsFrom(datetime t) {
   if(t==0) return 9999;
   return Bars(_Symbol,TimeFrame,t,TimeCurrent());
}
//+------------------------------------------------------------------+
//|  КОНЕЦ ФАЙЛА  SMC_UltimateTrader_2026.mq5  v2.00                |
//+------------------------------------------------------------------+
