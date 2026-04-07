//+------------------------------------------------------------------+
//|                   SMC_UltimateTrader_2026.mq5                    |
//|          Smart Money Concepts — Ultimate EA for XAU/USD          |
//|                   Версия: 1.00 | Год: 2026                       |
//+------------------------------------------------------------------+
//
//  АРХИТЕКТУРА СТРАТЕГИИ:
//  ┌──────────────────────────────────────────────────────────────┐
//  │  ФАЗА 1: Liquidity Grab (Sweep)                              │
//  │          Захват SSL/BSL (PDH/PDL/Asian Range/Weekly High-Low) │
//  │          Паттерн Turtle Soup (тень пробивает, тело — нет)    │
//  ├──────────────────────────────────────────────────────────────┤
//  │  ФАЗА 2: CISD (Change in State of Delivery)                  │
//  │          Bullish: свеча закрывается выше Open блока доставки │
//  │          Bearish: свеча закрывается ниже Open блока доставки  │
//  ├──────────────────────────────────────────────────────────────┤
//  │  ФАЗА 3: FVG / iFVG Entry                                    │
//  │          Buy Limit / Sell Limit @ 50% FVG (CE) или iFVG      │
//  │          SL — за экстремум свечи захвата + спред             │
//  └──────────────────────────────────────────────────────────────┘
//
#property copyright   "SMC Ultimate Trading System 2026"
#property link        "https://github.com/allai-77/allai-77"
#property version     "1.00"
#property description "Полностью автоматический советник на основе SMC/ICT"
#property description "Стратегия: Liquidity Grab → CISD → FVG/iFVG Entry"
#property strict

//+------------------------------------------------------------------+
//|                   СТАНДАРТНЫЕ БИБЛИОТЕКИ MT5                     |
//+------------------------------------------------------------------+
#include <Trade\Trade.mqh>           // Безопасное исполнение ордеров
#include <Trade\PositionInfo.mqh>    // Информация о позиции
#include <Trade\OrderInfo.mqh>       // Информация об ордерах
#include <Trade\SymbolInfo.mqh>      // Информация о символе

//+------------------------------------------------------------------+
//|                   РАЗДЕЛ 1: ВХОДНЫЕ ПАРАМЕТРЫ                    |
//+------------------------------------------------------------------+

input group "=== ОСНОВНЫЕ НАСТРОЙКИ ==="
input string            EA_Comment           = "SMC_2026";    // Комментарий к ордерам
input long              Magic                = 202600;        // Magic Number
input ENUM_TIMEFRAMES   TimeFrame            = PERIOD_M15;    // Рабочий таймфрейм

input group "=== УПРАВЛЕНИЕ КАПИТАЛОМ ==="
input double   RiskPercent       = 1.0;   // Риск на сделку (% от эквити)
input double   PartialCloseRatio = 0.5;   // Доля частичного закрытия (0.5 = 50%)
input double   ATR_Multiplier    = 1.5;   // Множитель ATR для трейлинг-стопа
input int      ATR_Period        = 14;    // Период ATR
input double   MinFVG_Points     = 50.0;  // Минимальный размер FVG в пунктах

input group "=== ТОРГОВЫЕ СЕССИИ (ICT Kill Zones) ==="
input bool     UseNYKillZone      = true;  // NY Kill Zone (07:00-10:00 EST)
input bool     UseLondonKillZone  = true;  // London Kill Zone (02:00-05:00 EST)
input int      NY_Start_EST       = 7;     // NY старт (час EST)
input int      NY_End_EST         = 10;    // NY конец (час EST)
input int      London_Start_EST   = 2;     // London старт (час EST)
input int      London_End_EST     = 5;     // London конец (час EST)
input int      Asian_Start_EST    = 19;    // Asian Range старт (час EST)
input int      Asian_End_EST      = 22;    // Asian Range конец (час EST)

input group "=== DXY / МЕЖРЫНОЧНАЯ ФИЛЬТРАЦИЯ ==="
input bool     UseDXYFilter  = true;       // Включить DXY корреляцию
input string   DXY_Symbol    = "EURUSD";   // Символ для корреляции (обратная к DXY)
input int      DXY_MA_Period = 20;         // Период MA для DXY фильтра

input group "=== НОВОСТНОЙ ФИЛЬТР ==="
input bool     UseNewsFilter    = true;    // Включить новостной фильтр
input int      News_Before_Min  = 30;      // Минут ДО события (блокировка)
input int      News_After_Min   = 15;      // Минут ПОСЛЕ события (блокировка)

input group "=== ВИЗУАЛИЗАЦИЯ ==="
input bool     ShowFVG              = true;          // Рисовать зоны FVG
input bool     ShowLiquidityLevels  = true;          // Рисовать уровни ликвидности
input bool     ShowCISDLevels       = true;          // Рисовать уровни CISD
input color    FVG_Bull_Color       = clrPaleGreen;  // Цвет бычьего FVG
input color    FVG_Bear_Color       = clrLightPink;  // Цвет медвежьего FVG
input color    Liq_Color            = clrGold;       // Цвет уровней ликвидности
input color    CISD_Bull_Color      = clrDodgerBlue; // Цвет бычьего CISD
input color    CISD_Bear_Color      = clrOrangeRed;  // Цвет медвежьего CISD
input int      MaxLookbackBars      = 200;           // Глубина исторического анализа


//+------------------------------------------------------------------+
//|             РАЗДЕЛ 2: ПЕРЕЧИСЛЕНИЯ И СТРУКТУРЫ ДАННЫХ            |
//+------------------------------------------------------------------+

//--- Статус зоны Fair Value Gap
enum ENUM_FVG_STATUS
  {
   FVG_ACTIVE,      // Зона активна: цена ещё не дошла до неё
   FVG_MITIGATED,   // Зона закрыта: цена полностью прошла зону
   FVG_INVERTED     // Зона инвертирована: пробой полнотелой свечой → iFVG
  };

//--- Направление рыночного паттерна
enum ENUM_PATTERN_DIR
  {
   DIR_BULLISH,  // Бычье направление
   DIR_BEARISH,  // Медвежье направление
   DIR_NONE      // Направление не определено
  };

//--- Фаза торгового цикла (конечный автомат)
enum ENUM_CYCLE_PHASE
  {
   PHASE_HUNTING,   // Охота: ищем захват ликвидности
   PHASE_CISD,      // Ожидание подтверждения CISD
   PHASE_ENTRY,     // Ожидание формирования FVG для входа
   PHASE_MANAGING   // Управление открытой позицией
  };

//--- Структура уровня ликвидности (BSL/SSL)
struct SLiquidityLevel
  {
   double            price;       // Ценовой уровень
   datetime          time;        // Время формирования
   bool              isBSL;       // true=Buy Side Liq (выше рынка), false=Sell Side Liq
   bool              isSwept;     // Уровень захвачен?
   string            label;       // Метка: "PDH","PDL","PWH","PWL","ASH","ASL"
  };

//--- Структура захвата ликвидности
struct SLiquiditySweep
  {
   bool              detected;         // Захват зафиксирован?
   bool              isBullishSweep;   // true=SSL захвачен (→ покупка), false=BSL
   double            sweepHigh;        // Максимум свечи захвата (для расчёта SL)
   double            sweepLow;         // Минимум свечи захвата (для расчёта SL)
   double            sweepClose;       // Закрытие свечи захвата
   datetime          sweepTime;        // Время свечи захвата
   int               sweepBarShift;    // Сдвиг свечи захвата от текущего бара
  };

//--- Структура блока доставки и CISD
struct SCISDBlock
  {
   bool              detected;         // CISD подтверждён?
   bool              isBullishCISD;    // true=бычий CISD, false=медвежий
   double            deliveryOpenPx;   // Цена ОТКРЫТИЯ первой свечи блока доставки
   double            deliveryClosePx;  // Цена закрытия последней свечи блока доставки
   datetime          deliveryTime;     // Время начала блока доставки
   datetime          cisd_ConfirmTime; // Время свечи подтверждения CISD
  };

//--- Структура зоны FVG / iFVG
struct SFVG
  {
   double            fvgHigh;        // Верхняя граница FVG
   double            fvgLow;         // Нижняя граница FVG
   double            ce50;           // Consequent Encroachment: 50% FVG
   datetime          formationTime;  // Время формирования FVG
   ENUM_FVG_STATUS   status;         // Активен / Закрыт / Инвертирован
   ENUM_PATTERN_DIR  direction;      // Бычий или медвежий
   bool              orderPlaced;    // Отложенный ордер размещён?
   ulong             pendingTicket;  // Тикет отложенного ордера
   string            rectObjName;    // Имя прямоугольного объекта на графике
   string            ceObjName;      // Имя линии CE на графике
  };


//+------------------------------------------------------------------+
//|          РАЗДЕЛ 3: ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ОБЪЕКТЫ              |
//+------------------------------------------------------------------+

//--- Объекты стандартной библиотеки MQL5
CTrade         g_Trade;     // Объект для безопасного исполнения торговых операций
CPositionInfo  g_Position;  // Объект для чтения параметров открытых позиций
COrderInfo     g_Order;     // Объект для работы с отложенными ордерами
CSymbolInfo    g_Symbol;    // Объект для получения параметров торгового символа

//--- Хэндлы индикаторов
int   g_hATR      = INVALID_HANDLE;  // Хэндл ATR для основного символа
int   g_hATR_DXY  = INVALID_HANDLE;  // Хэндл ATR для символа-корреляции

//--- Состояние торгового цикла (конечный автомат)
ENUM_CYCLE_PHASE  g_CyclePhase   = PHASE_HUNTING;  // Текущая фаза цикла

//--- Активные данные цикла
SLiquidityLevel   g_Levels[];         // Пулы ликвидности
SLiquiditySweep   g_Sweep;            // Текущий захват ликвидности
SCISDBlock        g_CISD;             // Текущий блок доставки / CISD
SFVG              g_FVG;              // Активная FVG зона

//--- Параметры управления позицией
bool     g_PartialDone    = false;  // Флаг: частичное закрытие выполнено
double   g_InitVolume     = 0.0;    // Начальный объём позиции при открытии
datetime g_LastBarTime    = 0;      // Время последнего обработанного бара
datetime g_TrailBarTime   = 0;      // Время последнего пересчёта трейлинга
bool     g_DST            = false;  // Летнее время (DST) активно?

//--- Счётчик для уникальных имён графических объектов
int      g_ObjSeq         = 0;      // Последовательный счётчик объектов

//+------------------------------------------------------------------+
//|                РАЗДЕЛ 4: OnInit — ИНИЦИАЛИЗАЦИЯ                  |
//+------------------------------------------------------------------+
int OnInit()
  {
   Print("╔══════════════════════════════════════════════╗");
   Print("║   SMC Ultimate EA 2026 | Инициализация       ║");
   Print("╚══════════════════════════════════════════════╝");
   Print("Символ: ", _Symbol, " | ТФ: ", EnumToString(TimeFrame),
         " | Magic: ", Magic);

   //--- 1. Инициализация символа
   if(!g_Symbol.Name(_Symbol))
     {
      Print("[FATAL] Ошибка инициализации символа: ", _Symbol);
      return INIT_FAILED;
     }
   g_Symbol.RefreshRates();

   //--- 2. Настройка объекта торговли
   g_Trade.SetExpertMagicNumber(Magic);
   g_Trade.SetDeviationInPoints(30);              // Допустимое проскальзывание
   g_Trade.SetTypeFilling(ORDER_FILLING_IOC);     // IOC — немедленно или отмена
   g_Trade.SetAsyncMode(false);                   // Синхронный режим
   g_Trade.LogLevel(LOG_LEVEL_ERRORS);            // Логировать только ошибки

   //--- 3. Создание ATR индикатора для основного символа
   g_hATR = iATR(_Symbol, TimeFrame, ATR_Period);
   if(g_hATR == INVALID_HANDLE)
     {
      Print("[FATAL] Не удалось создать ATR индикатор: ", GetLastError());
      return INIT_FAILED;
     }

   //--- 4. ATR для корреляционного символа
   if(UseDXYFilter && StringLen(DXY_Symbol) > 0)
     {
      g_hATR_DXY = iATR(DXY_Symbol, TimeFrame, ATR_Period);
      if(g_hATR_DXY == INVALID_HANDLE)
         Print("[WARN] ATR для ", DXY_Symbol, " недоступен. DXY фильтр будет пропущен.");
     }

   //--- 5. Определение летнего/зимнего времени
   g_DST = IsDSTActive();
   Print("DST (летнее время): ", g_DST ? "ДА (EST = UTC-4)" : "НЕТ (EST = UTC-5)");

   //--- 6. Первоначальная загрузка уровней ликвидности
   RefreshLiquidityLevels();

   //--- 7. Инициализация структур нулями
   ZeroMemory(g_Sweep);
   ZeroMemory(g_CISD);
   ZeroMemory(g_FVG);

   Print("[OK] Инициализация завершена успешно.");
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//|             РАЗДЕЛ 5: OnDeinit — ДЕИНИЦИАЛИЗАЦИЯ                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   //--- Освобождаем хэндлы индикаторов
   if(g_hATR     != INVALID_HANDLE) IndicatorRelease(g_hATR);
   if(g_hATR_DXY != INVALID_HANDLE) IndicatorRelease(g_hATR_DXY);

   //--- Удаляем все нарисованные советником объекты
   PurgeChartObjects();

   Print("SMC Ultimate EA 2026 | Деинициализация | Код: ", reason);
  }


//+------------------------------------------------------------------+
//|            РАЗДЕЛ 6: OnTick — ГЛАВНЫЙ ЦИКЛ СОВЕТНИКА             |
//+------------------------------------------------------------------+
void OnTick()
  {
   //--- Определяем, появился ли новый завершённый бар
   datetime newBarTime = iTime(_Symbol, TimeFrame, 0);
   bool isNewBar = (newBarTime != g_LastBarTime);

   if(isNewBar)
     {
      g_LastBarTime = newBarTime;

      //--- Ежебарные задачи ---

      // Обновление статуса летнего времени
      g_DST = IsDSTActive();

      // Обновление всех пулов ликвидности (PDH/PDL/Asian/Weekly)
      RefreshLiquidityLevels();

      // Обновление статуса активных FVG зон
      UpdateFVGStatus();

      // Запуск основного сигнального пайплайна
      RunSignalPipeline();

      // Пересчёт ATR трейлинг-стопа
      ApplyATRTrailing();
     }

   //--- Каждый тик: контроль достижения уровня частичного закрытия (1:1 R:R)
   CheckPartialCloseCondition();
  }

//+------------------------------------------------------------------+
//|        РАЗДЕЛ 7: OnTradeTransaction — СОБЫТИЯ ОРДЕРОВ            |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest      &request,
                        const MqlTradeResult       &result)
  {
   //--- Тип: ордер удалён из системы
   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE)
     {
      //--- Наш отложенный ордер был ИСПОЛНЕН
      if(trans.order == g_FVG.pendingTicket &&
         trans.order_state == ORDER_STATE_FILLED)
        {
         Print("═══ ВХОД ИСПОЛНЕН | Тикет: ", trans.order,
               " | Переход в фазу управления позицией ═══");
         g_FVG.orderPlaced  = false;
         g_PartialDone      = false;
         g_CyclePhase       = PHASE_MANAGING;

         // Запоминаем начальный объём для частичного закрытия
         if(PositionSelect(_Symbol) &&
            PositionGetInteger(POSITION_MAGIC) == Magic)
           g_InitVolume = PositionGetDouble(POSITION_VOLUME);
        }

      //--- Наш отложенный ордер был ОТМЕНЁН
      if(trans.order == g_FVG.pendingTicket &&
         trans.order_state == ORDER_STATE_CANCELED)
        {
         Print("[INFO] Отложенный ордер отменён (тикет: ", trans.order, "). Сброс цикла.");
         ResetTradeCycle();
        }
     }
  }

//+------------------------------------------------------------------+
//|         МОДУЛЬ 1: ОСНОВНОЙ СИГНАЛЬНЫЙ ПАЙПЛАЙН                  |
//|  Три последовательные фазы SMC: Sweep → CISD → FVG              |
//+------------------------------------------------------------------+
void RunSignalPipeline()
  {
   //--- ── Глобальные фильтры (применяются независимо от фазы) ──

   // ONNX фильтр режима рынка (трендовый / боковик)
   if(!EvaluateRegimeONNX())
     {
      Print("[ONNX] Боковой рынок. Новые входы заблокированы.");
      return;
     }

   // Новостной фильтр: запрет торговли вблизи High Impact событий USD
   if(UseNewsFilter && IsNewsWindow())
     {
      Print("[NEWS] Торговля заблокирована (новостное окно).");
      return;
     }

   // Если уже есть открытая позиция — новый сетап не ищем
   if(HasOpenPosition()) return;

   // Если отложенный ордер уже размещён — следим за его валидностью
   if(g_FVG.orderPlaced)
     {
      ValidatePendingOrder();
      return;
     }

   //═══════════════════════════════════════════════════════════════
   //  ФАЗА 1: ПОИСК ЗАХВАТА ЛИКВИДНОСТИ (Liquidity Sweep)
   //═══════════════════════════════════════════════════════════════
   if(g_CyclePhase == PHASE_HUNTING)
     {
      // Торговля разрешена ТОЛЬКО в Kill Zone
      if(!IsInKillZone())
        {
         CollectAsianRangeData();  // В азиатскую сессию — собираем данные
         return;
        }

      SLiquiditySweep sweep = DetectLiquiditySweep();
      if(sweep.detected)
        {
         g_Sweep      = sweep;
         g_CyclePhase = PHASE_CISD;
         Print("► ФАЗА 1 [SWEEP] | ",
               sweep.isBullishSweep
               ? "SSL захвачен → ожидаем бычий CISD"
               : "BSL захвачен → ожидаем медвежий CISD",
               " | Время: ", TimeToString(sweep.sweepTime),
               " | SweepLow: ", DoubleToString(sweep.sweepLow, _Digits),
               " | SweepHigh: ", DoubleToString(sweep.sweepHigh, _Digits));
        }
      return;
     }

   //═══════════════════════════════════════════════════════════════
   //  ФАЗА 2: ПОДТВЕРЖДЕНИЕ CISD
   //═══════════════════════════════════════════════════════════════
   if(g_CyclePhase == PHASE_CISD)
     {
      SCISDBlock cisd = DetectCISD(g_Sweep.isBullishSweep);
      if(cisd.detected)
        {
         g_CISD       = cisd;
         g_CyclePhase = PHASE_ENTRY;
         Print("► ФАЗА 2 [CISD] | ",
               cisd.isBullishCISD ? "Бычий" : "Медвежий",
               " CISD подтверждён | Блок открытия: ",
               DoubleToString(cisd.deliveryOpenPx, _Digits),
               " | Время: ", TimeToString(cisd.cisd_ConfirmTime));

         // DXY корреляционный фильтр
         if(UseDXYFilter && !CheckDXYCorrelation(cisd.isBullishCISD))
           {
            Print("[DXY] Межрыночная корреляция не подтверждена. Сброс цикла.");
            ResetTradeCycle();
            return;
           }
        }
      else
        {
         // Тайм-аут: если CISD не подтверждён за N баров — сбрасываем
         int elapsed = BarsElapsed(g_Sweep.sweepTime);
         if(elapsed > 25)
           {
            Print("[TIMEOUT] CISD не получен за 25 баров. Сброс цикла.");
            ResetTradeCycle();
           }
        }
      return;
     }

   //═══════════════════════════════════════════════════════════════
   //  ФАЗА 3: ПОИСК FVG И РАЗМЕЩЕНИЕ ОРДЕРА
   //═══════════════════════════════════════════════════════════════
   if(g_CyclePhase == PHASE_ENTRY)
     {
      SFVG fvg = DetectFVG(g_CISD.isBullishCISD);
      if(fvg.fvgHigh > 0.0)
        {
         g_FVG = fvg;

         // Расчёт Stop Loss на основе свечи захвата
         double slPrice = CalcSLFromSweep(g_CISD.isBullishCISD, g_Sweep);

         // Расчёт динамического объёма позиции
         double lot = CalcDynamicLot(fvg, slPrice);
         if(lot <= 0.0)
           {
            Print("[RISK] Расчёт лота вернул 0. Размещение ордера отменено.");
            return;
           }

         // Размещение отложенного Buy Limit / Sell Limit
         if(PlaceFVGPendingOrder(fvg, slPrice, lot))
           {
            if(ShowFVG) DrawFVGZone(fvg);
            Print("► ФАЗА 3 [FVG] | Ордер размещён | ",
                  fvg.direction == DIR_BULLISH ? "Buy Limit" : "Sell Limit",
                  " @ ", DoubleToString(fvg.ce50, _Digits),
                  " | SL: ", DoubleToString(slPrice, _Digits),
                  " | Лот: ", DoubleToString(lot, 2),
                  " | Статус FVG: ", EnumToString(fvg.status));
           }
        }
      else
        {
         // Тайм-аут ожидания FVG
         int elapsed = BarsElapsed(g_CISD.cisd_ConfirmTime);
         if(elapsed > 15)
           {
            Print("[TIMEOUT] FVG не найден за 15 баров после CISD. Сброс цикла.");
            ResetTradeCycle();
           }
        }
     }
  }


//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.1: ОБНАРУЖЕНИЕ ЗАХВАТА ЛИКВИДНОСТИ (Liquidity Sweep) |
//|                                                                   |
//|  Паттерн Turtle Soup:                                            |
//|  • Тень свечи ПРОБИВАЕТ уровень ликвидности                      |
//|  • Тело свечи (закрытие) ОСТАЁТСЯ по другую сторону уровня       |
//|  ⇒ Ложный пробой = захват ликвидности                            |
//+------------------------------------------------------------------+
SLiquiditySweep DetectLiquiditySweep()
  {
   SLiquiditySweep res;
   ZeroMemory(res);

   MqlRates bars[];
   ArraySetAsSeries(bars, true);
   // Копируем 4 бара: [0]=текущий (незакрытый), [1]=последний закрытый
   if(CopyRates(_Symbol, TimeFrame, 0, 4, bars) < 3) return res;

   // Анализируем только последний ЗАКРЫТЫЙ бар (индекс 1)
   MqlRates &c = bars[1];

   int n = ArraySize(g_Levels);
   for(int i = 0; i < n; i++)
     {
      if(g_Levels[i].isSwept) continue;  // Уже захвачен — пропускаем

      double lvl = g_Levels[i].price;

      //─── ЗАХВАТ BSL (Buy Side Liquidity) → медвежий сигнал ───
      //  Тень вверх пробила BSL, но тело закрылось ниже него
      if(g_Levels[i].isBSL &&
         c.high > lvl &&       // Тень пробивает уровень вверх
         c.close < lvl)        // Закрытие строго под уровнем (ложный пробой)
        {
         g_Levels[i].isSwept  = true;
         res.detected          = true;
         res.isBullishSweep    = false;   // BSL захвачен → продажа
         res.sweepHigh         = c.high;
         res.sweepLow          = c.low;
         res.sweepClose        = c.close;
         res.sweepTime         = c.time;
         res.sweepBarShift     = 1;
         Print("[SWEEP] BSL захвачен | Уровень: ", DoubleToString(lvl, _Digits),
               " (", g_Levels[i].label, ")",
               " | Тень до: ", DoubleToString(c.high, _Digits),
               " | Закрытие: ", DoubleToString(c.close, _Digits));
         return res;
        }

      //─── ЗАХВАТ SSL (Sell Side Liquidity) → бычий сигнал ───
      //  Тень вниз пробила SSL, но тело закрылось выше него
      if(!g_Levels[i].isBSL &&
         c.low < lvl &&        // Тень пробивает уровень вниз
         c.close > lvl)        // Закрытие строго над уровнем (ложный пробой)
        {
         g_Levels[i].isSwept  = true;
         res.detected          = true;
         res.isBullishSweep    = true;    // SSL захвачен → покупка
         res.sweepHigh         = c.high;
         res.sweepLow          = c.low;
         res.sweepClose        = c.close;
         res.sweepTime         = c.time;
         res.sweepBarShift     = 1;
         Print("[SWEEP] SSL захвачен | Уровень: ", DoubleToString(lvl, _Digits),
               " (", g_Levels[i].label, ")",
               " | Тень до: ", DoubleToString(c.low, _Digits),
               " | Закрытие: ", DoubleToString(c.close, _Digits));
         return res;
        }
     }
   return res;
  }

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.2: ОБНАРУЖЕНИЕ CISD                                   |
//|              (Change in State of Delivery)                        |
//|                                                                   |
//|  Bullish CISD:                                                    |
//|    Найти медвежий блок доставки (падающие свечи перед SSL sweep) |
//|    Свеча подтверждения закрывается ВЫШЕ Open[первой медв.свечи]  |
//|                                                                   |
//|  Bearish CISD:                                                    |
//|    Найти бычий блок доставки (растущие свечи перед BSL sweep)    |
//|    Свеча подтверждения закрывается НИЖЕ Open[первой бычь.свечи]  |
//+------------------------------------------------------------------+
SCISDBlock DetectCISD(const bool bullishSweep)
  {
   SCISDBlock res;
   ZeroMemory(res);

   MqlRates bars[];
   ArraySetAsSeries(bars, true);
   // Загружаем достаточный массив баров для анализа блока доставки
   if(CopyRates(_Symbol, TimeFrame, 0, 40, bars) < 10) return res;

   // Индекс 1 = последняя закрытая свеча (потенциальная свеча CISD)
   int confirmIdx = 1;
   MqlRates &confirmBar = bars[confirmIdx];

   // Начало поиска блока доставки: бары ПЕРЕД свечой захвата
   // sweepBarShift=1 означает бар[1] → блок до него начинается с бар[2+]
   int searchFrom = g_Sweep.sweepBarShift + 1;

   if(bullishSweep)
     {
      //─── BULLISH CISD: ищем медвежий блок доставки ───
      // Медвежий блок = последовательные красные свечи (close < open),
      // предшествовавшие захвату SSL

      // Находим первую свечу медвежьего блока (самую раннюю)
      int blockFirstIdx = -1;
      for(int i = searchFrom; i < MathMin(40, searchFrom + 15); i++)
        {
         if(bars[i].close < bars[i].open)   // Медвежья свеча
           {
            blockFirstIdx = i;
            // Расширяем блок назад: ищем непрерывную серию медвежьих свечей
            while(blockFirstIdx + 1 < 40 &&
                  bars[blockFirstIdx + 1].close < bars[blockFirstIdx + 1].open)
               blockFirstIdx++;
            break;
           }
        }

      if(blockFirstIdx < 0) return res;  // Блок доставки не найден

      double blockOpenPx = bars[blockFirstIdx].open;  // Открытие первой свечи блока

      // Свеча подтверждения ДОЛЖНА:
      // 1. Закрыться СТРОГО ВЫШЕ открытия первой свечи блока
      // 2. Быть бычьей (close > open) — дополнительный фильтр качества
      if(confirmBar.close > blockOpenPx &&
         confirmBar.close > confirmBar.open)
        {
         res.detected          = true;
         res.isBullishCISD     = true;
         res.deliveryOpenPx    = blockOpenPx;
         res.deliveryClosePx   = bars[blockFirstIdx].close;
         res.deliveryTime      = bars[blockFirstIdx].time;
         res.cisd_ConfirmTime  = confirmBar.time;

         if(ShowCISDLevels)
            DrawHLine("CISD_B_" + TimeToString(confirmBar.time, TIME_DATE|TIME_MINUTES),
                      blockOpenPx, CISD_Bull_Color, STYLE_DASHDOTDOT, 2);
        }
     }
   else
     {
      //─── BEARISH CISD: ищем бычий блок доставки ───
      int blockFirstIdx = -1;
      for(int i = searchFrom; i < MathMin(40, searchFrom + 15); i++)
        {
         if(bars[i].close > bars[i].open)   // Бычья свеча
           {
            blockFirstIdx = i;
            while(blockFirstIdx + 1 < 40 &&
                  bars[blockFirstIdx + 1].close > bars[blockFirstIdx + 1].open)
               blockFirstIdx++;
            break;
           }
        }

      if(blockFirstIdx < 0) return res;

      double blockOpenPx = bars[blockFirstIdx].open;

      // Свеча подтверждения: закрывается НИЖЕ открытия бычьего блока
      if(confirmBar.close < blockOpenPx &&
         confirmBar.close < confirmBar.open)
        {
         res.detected          = true;
         res.isBullishCISD     = false;
         res.deliveryOpenPx    = blockOpenPx;
         res.deliveryClosePx   = bars[blockFirstIdx].close;
         res.deliveryTime      = bars[blockFirstIdx].time;
         res.cisd_ConfirmTime  = confirmBar.time;

         if(ShowCISDLevels)
            DrawHLine("CISD_R_" + TimeToString(confirmBar.time, TIME_DATE|TIME_MINUTES),
                      blockOpenPx, CISD_Bear_Color, STYLE_DASHDOTDOT, 2);
        }
     }

   return res;
  }


//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.3: ОБНАРУЖЕНИЕ FVG / iFVG                             |
//|                                                                   |
//|  3-свечной паттерн Fair Value Gap:                               |
//|  Bullish FVG: Low[right] > High[left]   — зазор снизу вверх     |
//|  Bearish FVG: High[right] < Low[left]   — зазор сверху вниз     |
//|                                                                   |
//|  Если зона FVG уже инвертирована (iFVG):                         |
//|  Полнотелая свеча пробила зону → вход от проксимальной границы  |
//+------------------------------------------------------------------+
SFVG DetectFVG(const bool bullishCISD)
  {
   SFVG res;
   ZeroMemory(res);

   MqlRates bars[];
   ArraySetAsSeries(bars, true);
   if(CopyRates(_Symbol, TimeFrame, 0, 25, bars) < 5) return res;

   double pt    = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double minSz = MinFVG_Points * pt;  // Минимальный размер зоны

   // Сканируем бары начиная от CISD свечи (индекс 1) вперёд
   // i+1=left, i=middle, i-1=right (нумерация от текущего назад)
   for(int i = 3; i < MathMin(25, 20); i++)
     {
      MqlRates &left   = bars[i + 1];   // Левая (более старая)
      MqlRates &middle = bars[i];       // Средняя (импульсная)
      MqlRates &right  = bars[i - 1];   // Правая (более новая)

      if(bullishCISD)
        {
         //─── Бычий FVG ───
         // Условие: Low правой свечи ВЫШЕ High левой свечи
         // Имбаланс: пространство [left.high … right.low]
         if(right.low > left.high)
           {
            double sz = right.low - left.high;
            if(sz < minSz) continue;  // Зона слишком мала

            res.fvgHigh       = right.low;
            res.fvgLow        = left.high;
            res.ce50          = (res.fvgHigh + res.fvgLow) / 2.0;
            res.formationTime = middle.time;
            res.direction     = DIR_BULLISH;
            res.status        = FVG_ACTIVE;

            // Проверяем: была ли зона уже инвертирована последующими барами?
            res.status = CheckIfFVGInverted(res, bars, i - 2);

            Print("[FVG] Бычий | H:", DoubleToString(res.fvgHigh, _Digits),
                  " L:", DoubleToString(res.fvgLow, _Digits),
                  " CE:", DoubleToString(res.ce50, _Digits),
                  " Размер:", DoubleToString(sz / pt, 0), "pts",
                  " Статус:", EnumToString(res.status));
            return res;
           }
        }
      else
        {
         //─── Медвежий FVG ───
         // Условие: High правой свечи НИЖЕ Low левой свечи
         // Имбаланс: пространство [right.high … left.low]
         if(right.high < left.low)
           {
            double sz = left.low - right.high;
            if(sz < minSz) continue;

            res.fvgHigh       = left.low;
            res.fvgLow        = right.high;
            res.ce50          = (res.fvgHigh + res.fvgLow) / 2.0;
            res.formationTime = middle.time;
            res.direction     = DIR_BEARISH;
            res.status        = FVG_ACTIVE;

            res.status = CheckIfFVGInverted(res, bars, i - 2);

            Print("[FVG] Медвежий | H:", DoubleToString(res.fvgHigh, _Digits),
                  " L:", DoubleToString(res.fvgLow, _Digits),
                  " CE:", DoubleToString(res.ce50, _Digits),
                  " Размер:", DoubleToString(sz / pt, 0), "pts",
                  " Статус:", EnumToString(res.status));
            return res;
           }
        }
     }

   return res;  // FVG не найден
  }

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.4: ПРОВЕРКА ИНВЕРСИИ FVG → iFVG                      |
//|  Если полнотелая свеча пробивает зону — зона становится iFVG     |
//+------------------------------------------------------------------+
ENUM_FVG_STATUS CheckIfFVGInverted(const SFVG &fvg,
                                    const MqlRates &bars[],
                                    const int       startBar)
  {
   for(int i = startBar; i >= 0; i--)
     {
      // Тело свечи (без теней)
      double bodyH = MathMax(bars[i].open, bars[i].close);
      double bodyL = MathMin(bars[i].open, bars[i].close);

      if(fvg.direction == DIR_BULLISH)
        {
         // Полнотелое закрытие НИЖЕ нижней границы FVG = инверсия
         if(bodyL < fvg.fvgLow && bodyH > fvg.fvgLow)
            return FVG_INVERTED;
         // Цена полностью прошла зону вниз = зона закрыта
         if(bodyH < fvg.fvgLow)
            return FVG_MITIGATED;
        }
      else
        {
         // Полнотелое закрытие ВЫШЕ верхней границы FVG = инверсия
         if(bodyH > fvg.fvgHigh && bodyL < fvg.fvgHigh)
            return FVG_INVERTED;
         // Цена полностью прошла зону вверх = зона закрыта
         if(bodyL > fvg.fvgHigh)
            return FVG_MITIGATED;
        }
     }
   return FVG_ACTIVE;
  }

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.5: РАСЧЁТ STOP LOSS ПО ЭКСТРЕМУМУ СВЕЧИ ЗАХВАТА     |
//|  SL = экстремум свечи захвата + (спред + 5 пунктов) буфер       |
//+------------------------------------------------------------------+
double CalcSLFromSweep(const bool isBullish, const SLiquiditySweep &sw)
  {
   double spread  = SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                  - SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double pt      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double buffer  = spread + 5.0 * pt;   // Буфер: спред + 5 пунктов

   double sl = isBullish
               ? sw.sweepLow  - buffer   // Покупка: SL под минимумом свечи захвата
               : sw.sweepHigh + buffer;  // Продажа: SL над максимумом свечи захвата

   return NormalizeDouble(sl, _Digits);
  }

//+------------------------------------------------------------------+
//|  ФУНКЦИЯ 1.6: РАЗМЕЩЕНИЕ ОТЛОЖЕННОГО ОРДЕРА ПО FVG              |
//+------------------------------------------------------------------+
bool PlaceFVGPendingOrder(SFVG &fvg, const double slPrice, const double lot)
  {
   double pt = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   // Определяем цену входа в зависимости от статуса FVG
   double entryPx = 0.0;
   if(fvg.status == FVG_ACTIVE)
     {
      // Активный FVG: вход на 50% зоны (Consequent Encroachment)
      entryPx = fvg.ce50;
     }
   else if(fvg.status == FVG_INVERTED)
     {
      // iFVG: вход от проксимальной границы (ближней к цене)
      entryPx = (fvg.direction == DIR_BULLISH) ? fvg.fvgLow : fvg.fvgHigh;
      Print("[iFVG] Инвертированный FVG. Вход от проксимальной границы: ",
            DoubleToString(entryPx, _Digits));
     }
   else
     {
      Print("[WARN] FVG полностью закрыт (MITIGATED). Пропускаем.");
      return false;
     }

   // Расчёт Take Profit: минимум 2:1 Risk-to-Reward
   double riskDist = MathAbs(entryPx - slPrice);
   if(riskDist < pt * 10)
     {
      Print("[RISK] SL слишком близко (", DoubleToString(riskDist/pt,0), " pts). Отмена.");
      return false;
     }

   ENUM_ORDER_TYPE orderType;
   double tpPrice;

   if(fvg.direction == DIR_BULLISH)
     {
      orderType = ORDER_TYPE_BUY_LIMIT;
      tpPrice   = entryPx + riskDist * 2.0;   // TP = 2R
     }
   else
     {
      orderType = ORDER_TYPE_SELL_LIMIT;
      tpPrice   = entryPx - riskDist * 2.0;
     }

   entryPx = NormalizeDouble(entryPx, _Digits);
   tpPrice = NormalizeDouble(tpPrice, _Digits);

   // Срок действия ордера: 24 часа от текущего времени
   datetime expiry = TimeCurrent() + 86400;

   bool ok = g_Trade.OrderOpen(
      _Symbol, orderType, lot, 0,
      entryPx, slPrice, tpPrice,
      ORDER_TIME_SPECIFIED, expiry,
      EA_Comment + (fvg.direction == DIR_BULLISH ? "_BL" : "_SL")
   );

   if(ok)
     {
      fvg.pendingTicket = g_Trade.ResultOrder();
      fvg.orderPlaced   = true;
      Print("[ORDER] Ордер #", fvg.pendingTicket, " размещён | ",
            EnumToString(orderType), " @ ", DoubleToString(entryPx, _Digits),
            " SL:", DoubleToString(slPrice, _Digits),
            " TP:", DoubleToString(tpPrice, _Digits),
            " Lot:", DoubleToString(lot, 2));
      return true;
     }
   else
     {
      Print("[ERROR] OrderOpen: код ", g_Trade.ResultRetcode(),
            " — ", g_Trade.ResultRetcodeDescription());
      return false;
     }
  }


//+------------------------------------------------------------------+
//|      МОДУЛЬ 2: ICT KILL ZONES — УПРАВЛЕНИЕ ТОРГОВЫМИ СЕССИЯМИ   |
//+------------------------------------------------------------------+

//--- Определение активности летнего времени DST (USA Eastern Time)
//    DST в США: второе воскресенье марта — первое воскресенье ноября
bool IsDSTActive()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);

   int m = dt.mon;
   int d = dt.day;

   // Апрель–Октябрь: DST однозначно активен
   if(m > 3 && m < 11) return true;
   // Январь, Февраль, Декабрь: DST неактивен
   if(m < 3 || m > 11) return false;

   // Март: DST начинается со второго воскресенья
   if(m == 3)
     {
      // Находим день второго воскресенья марта
      int sunCount = 0;
      for(int day = 1; day <= 31; day++)
        {
         // Алгоритм Томохиро Кубота для дня недели
         int y = dt.year, mo = 3;
         int t[] = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
         if(mo < 3) y--;
         int dow = (y + y/4 - y/100 + y/400 + t[mo-1] + day) % 7; // 0=вс
         if(dow == 0)
           {
            sunCount++;
            if(sunCount == 2) return (d >= day);
           }
        }
      return false;
     }

   // Ноябрь: DST заканчивается в первое воскресенье
   if(m == 11)
     {
      for(int day = 1; day <= 7; day++)
        {
         int y = dt.year, mo = 11;
         int t[] = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
         if(mo < 3) y--;
         int dow = (y + y/4 - y/100 + y/400 + t[mo-1] + day) % 7;
         if(dow == 0) return (d < day);
        }
     }

   return false;
  }

//--- Конвертация часа по EST в час по UTC
int ESTtoUTC(const int estHour)
  {
   // DST: EST = UTC-4, зима: EST = UTC-5
   int offset = g_DST ? 4 : 5;
   return (estHour + offset) % 24;
  }

//--- Проверка, находимся ли мы в активной Kill Zone
bool IsInKillZone()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   int h = dt.hour;

   //─── New York Kill Zone: 07:00–10:00 EST ───
   if(UseNYKillZone)
     {
      int s = ESTtoUTC(NY_Start_EST);
      int e = ESTtoUTC(NY_End_EST);
      if(HourInRange(h, s, e)) return true;
     }

   //─── London Kill Zone: 02:00–05:00 EST ───
   if(UseLondonKillZone)
     {
      int s = ESTtoUTC(London_Start_EST);
      int e = ESTtoUTC(London_End_EST);
      if(HourInRange(h, s, e)) return true;
     }

   return false;
  }

//--- Вспомогательная: входит ли час h в диапазон [start, end) с учётом полуночи
bool HourInRange(const int h, const int start, const int end)
  {
   if(start < end)
      return (h >= start && h < end);
   else  // Диапазон перекрывает полночь (например, 23–02)
      return (h >= start || h < end);
  }

//--- Сбор данных Азиатской сессии (без открытия ордеров)
void CollectAsianRangeData()
  {
   // Азиатская сессия уже обрабатывается в UpdateLiquidityLevels()
   // Здесь можно добавить дополнительную аналитику при необходимости
  }

//+------------------------------------------------------------------+
//|      МОДУЛЬ 3: ДИНАМИЧЕСКОЕ УПРАВЛЕНИЕ КАПИТАЛОМ                 |
//+------------------------------------------------------------------+

//--- Расчёт размера лота на основе риска в % от эквити
double CalcDynamicLot(const SFVG &fvg, const double slPrice)
  {
   // Текущее состояние счёта
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskAmount = equity * RiskPercent / 100.0;  // Денежный риск

   // Цена входа (50% FVG)
   double entryPx    = fvg.ce50;
   double slDist     = MathAbs(entryPx - slPrice);    // Расстояние до SL
   double pt         = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(slDist < pt * 5)
     {
      Print("[RISK] SL расстояние слишком мало: ", DoubleToString(slDist/pt, 1), " pts");
      return 0.0;
     }

   // Стоимость одного пункта на 1 лот
   // tickValue / tickSize * point = стоимость 1 пункта
   double tickVal  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSz   = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double ptValue  = (tickSz > 0) ? (tickVal / tickSz) * pt : 0.0;

   if(ptValue <= 0)
     {
      Print("[RISK] Не удалось получить стоимость пункта.");
      return 0.0;
     }

   // Лот = Риск$ / (Пунктов до SL * Стоимость пункта)
   double slPts   = slDist / pt;
   double lot     = riskAmount / (slPts * ptValue);

   // Нормализация по параметрам символа
   double step    = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   lot = MathFloor(lot / step) * step;
   lot = MathMax(minLot, MathMin(maxLot, lot));

   Print("[LOT] Эквити: $", DoubleToString(equity, 2),
         " Риск: $",        DoubleToString(riskAmount, 2),
         " SL: ",           DoubleToString(slPts, 0), "pts",
         " PtVal: ",        DoubleToString(ptValue, 4),
         " → Лот: ",        DoubleToString(lot, 2));
   return lot;
  }

//--- Проверка условия частичного закрытия (1:1 R:R) на каждом тике
void CheckPartialCloseCondition()
  {
   // Нет позиции или уже закрыли частично
   if(!HasOpenPosition() || g_PartialDone) return;

   if(!PositionSelect(_Symbol))               return;
   if(PositionGetInteger(POSITION_MAGIC) != Magic) return;

   long   posType  = PositionGetInteger(POSITION_TYPE);
   double openPx   = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl       = PositionGetDouble(POSITION_SL);
   double tp       = PositionGetDouble(POSITION_TP);
   double vol      = PositionGetDouble(POSITION_VOLUME);
   ulong  ticket   = PositionGetInteger(POSITION_TICKET);

   double riskDist = MathAbs(openPx - sl);
   if(riskDist <= 0) return;

   // Текущая цена (bid для покупки, ask для продажи)
   double curPx = (posType == POSITION_TYPE_BUY)
                  ? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                  : SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // Условие 1:1 R:R
   bool hit1R = (posType == POSITION_TYPE_BUY)
                ? (curPx >= openPx + riskDist)
                : (curPx <= openPx - riskDist);

   if(!hit1R) return;

   //─── Частичное закрытие 50% объёма ───
   double closeVol = NormalizeDouble(vol * PartialCloseRatio,
                                     (int)(-MathLog10(
                                        SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP)
                                     )));
   double minVol   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(closeVol < minVol) closeVol = minVol;
   if(closeVol >= vol)   closeVol = vol * 0.5;  // Страховка

   bool closedOk = g_Trade.PositionClosePartial(ticket, closeVol);
   if(closedOk)
     {
      Print("[1R] Частичное закрытие 50% | Объём: ", DoubleToString(closeVol, 2),
            " | Цена: ", DoubleToString(curPx, _Digits));
      g_PartialDone = true;

      // Перенос SL в безубыток (Breakeven)
      double spread = SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                    - SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double beSL   = (posType == POSITION_TYPE_BUY)
                      ? NormalizeDouble(openPx + spread, _Digits)
                      : NormalizeDouble(openPx - spread, _Digits);

      // Небольшая задержка для обновления позиции после частичного закрытия
      Sleep(100);

      if(PositionSelect(_Symbol) && PositionGetInteger(POSITION_MAGIC) == Magic)
        {
         ulong newTicket = PositionGetInteger(POSITION_TICKET);
         bool  modOk     = g_Trade.PositionModify(newTicket, beSL,
                                                    NormalizeDouble(tp, _Digits));
         if(modOk)
            Print("[BE] SL перенесён в безубыток: ", DoubleToString(beSL, _Digits));
         else
            Print("[ERROR] Ошибка переноса SL в BE: ", g_Trade.ResultRetcode());
        }
     }
   else
     {
      Print("[ERROR] Частичное закрытие не удалось: ", g_Trade.ResultRetcode(),
            " — ", g_Trade.ResultRetcodeDescription());
     }
  }

//--- ATR Трейлинг-стоп (пересчёт только на новом баре)
void ApplyATRTrailing()
  {
   if(!HasOpenPosition()) return;

   datetime barTime = iTime(_Symbol, TimeFrame, 0);
   if(barTime == g_TrailBarTime) return;  // Уже обработан этот бар
   g_TrailBarTime = barTime;

   // Получаем значение ATR с предыдущего закрытого бара (shift=1)
   double atrBuf[];
   ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(g_hATR, 0, 1, 1, atrBuf) < 1)
     {
      Print("[ATR] Не удалось получить данные ATR");
      return;
     }
   double atrDist = atrBuf[0] * ATR_Multiplier;

   if(!PositionSelect(_Symbol)) return;
   if(PositionGetInteger(POSITION_MAGIC) != Magic) return;

   long   posType = PositionGetInteger(POSITION_TYPE);
   double curSL   = PositionGetDouble(POSITION_SL);
   double curTP   = PositionGetDouble(POSITION_TP);
   ulong  ticket  = PositionGetInteger(POSITION_TICKET);
   double bid     = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask     = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   double newSL   = curSL;
   bool   doMod   = false;

   if(posType == POSITION_TYPE_BUY)
     {
      // Трейлинг вверх: SL = Bid - ATR*mult
      double proposed = NormalizeDouble(bid - atrDist, _Digits);
      if(proposed > curSL && proposed < bid)  // Только вверх, не ниже текущего SL
        {
         newSL  = proposed;
         doMod  = true;
        }
     }
   else if(posType == POSITION_TYPE_SELL)
     {
      // Трейлинг вниз: SL = Ask + ATR*mult
      double proposed = NormalizeDouble(ask + atrDist, _Digits);
      if(proposed < curSL && proposed > ask)  // Только вниз, не выше текущего SL
        {
         newSL  = proposed;
         doMod  = true;
        }
     }

   if(doMod)
     {
      bool ok = g_Trade.PositionModify(ticket, newSL, NormalizeDouble(curTP, _Digits));
      if(ok)
         Print("[TRAIL] ATR трейлинг | Новый SL: ", DoubleToString(newSL, _Digits),
               " (ATR*mult=", DoubleToString(atrDist/_Digits, 1), "pts)");
     }
  }


//+------------------------------------------------------------------+
//|      МОДУЛЬ 4: МАКРОЭКОНОМИЧЕСКАЯ И МЕЖРЫНОЧНАЯ ФИЛЬТРАЦИЯ       |
//+------------------------------------------------------------------+

//--- Фильтр корреляции с DXY (через EURUSD как обратно-коррелирующий актив)
//
//  Логика фильтра:
//  DXY ↑  → XAU/USD ↓   (обратная корреляция)
//  DXY ↓  → XAU/USD ↑
//  EURUSD ↑ ≈ DXY ↓     (EURUSD = обратный прокси DXY)
//
//  Для ПОКУПКИ XAU/USD: EURUSD должен быть выше своей MA (бычий → DXY медвежий)
//  Для ПРОДАЖИ XAU/USD: EURUSD должен быть ниже своей MA (медвежий → DXY бычий)
bool CheckDXYCorrelation(const bool bullishEntry)
  {
   if(!UseDXYFilter) return true;

   // Проверяем доступность символа
   if(!SymbolInfoInteger(DXY_Symbol, SYMBOL_SELECT))
     {
      Print("[DXY] Символ ", DXY_Symbol, " недоступен. Фильтр пропущен.");
      return true;
     }

   MqlRates dRates[];
   ArraySetAsSeries(dRates, true);
   int copied = CopyRates(DXY_Symbol, TimeFrame, 0, DXY_MA_Period + 5, dRates);
   if(copied < DXY_MA_Period + 2)
     {
      Print("[DXY] Недостаточно данных для ", DXY_Symbol, ". Фильтр пропущен.");
      return true;
     }

   // Вычисляем простую скользящую среднюю (SMA) за DXY_MA_Period баров
   double sum = 0;
   for(int i = 1; i <= DXY_MA_Period; i++) sum += dRates[i].close;
   double ma = sum / DXY_MA_Period;
   double lastClose = dRates[1].close;

   bool dxyBullishProxy = (lastClose > ma);  // EURUSD выше MA → DXY слаб → XAU бычий
   bool pass = bullishEntry ? dxyBullishProxy : !dxyBullishProxy;

   Print("[DXY] ", DXY_Symbol, " last=", DoubleToString(lastClose, _Digits),
         " MA(", DXY_MA_Period, ")=", DoubleToString(ma, _Digits),
         " | Фильтр: ", pass ? "ПРОЙДЕН" : "ЗАБЛОКИРОВАН");
   return pass;
  }

//--- Новостной фильтр через MQL5 Economic Calendar API
bool IsNewsWindow()
  {
   if(!UseNewsFilter) return false;

   // Окно блокировки вокруг события
   datetime now  = TimeCurrent();
   datetime from = now - (datetime)(News_Before_Min * 60);
   datetime to   = now + (datetime)(News_After_Min  * 60);

   // Запрашиваем события по USD из Экономического календаря MT5
   MqlCalendarValue vals[];
   int cnt = CalendarValueHistory(vals, from, to, NULL, "USD");

   if(cnt <= 0) return false;

   for(int i = 0; i < cnt; i++)
     {
      MqlCalendarEvent ev;
      if(CalendarEventById(vals[i].event_id, ev))
        {
         // Блокируем только события ВЫСОКОЙ значимости
         if(ev.importance == CALENDAR_IMPORTANCE_HIGH)
           {
            Print("[NEWS] High Impact USD: \"", ev.name, "\"",
                  " | Время: ", TimeToString(vals[i].time),
                  " | Торговля заблокирована на ",
                  News_Before_Min, " мин до / ", News_After_Min, " мин после");
            return true;
           }
        }
     }

   return false;
  }

//+------------------------------------------------------------------+
//|         МОДУЛЬ 5: УРОВНИ ЛИКВИДНОСТИ (PDH/PDL/Weekly/Asian)     |
//+------------------------------------------------------------------+

//--- Полное обновление пулов ликвидности
void RefreshLiquidityLevels()
  {
   ArrayResize(g_Levels, 0);  // Очищаем старый массив

   AppendDailyLevels();   // PDH / PDL
   AppendWeeklyLevels();  // PWH / PWL
   AppendAsianLevels();   // ASH / ASL

   if(ShowLiquidityLevels) RenderLiquidityLines();

   Print("[LIQ] Уровней ликвидности: ", ArraySize(g_Levels));
  }

//--- Уровни предыдущего торгового дня
void AppendDailyLevels()
  {
   MqlRates d[];
   ArraySetAsSeries(d, true);
   if(CopyRates(_Symbol, PERIOD_D1, 1, 1, d) < 1) return;

   int sz = ArraySize(g_Levels);
   ArrayResize(g_Levels, sz + 2);

   g_Levels[sz  ] = BuildLevel(d[0].high, d[0].time, true,  "PDH");
   g_Levels[sz+1] = BuildLevel(d[0].low,  d[0].time, false, "PDL");

   Print("[LIQ] PDH=", DoubleToString(d[0].high, _Digits),
         " PDL=", DoubleToString(d[0].low, _Digits));
  }

//--- Уровни предыдущей недели
void AppendWeeklyLevels()
  {
   MqlRates w[];
   ArraySetAsSeries(w, true);
   if(CopyRates(_Symbol, PERIOD_W1, 1, 1, w) < 1) return;

   int sz = ArraySize(g_Levels);
   ArrayResize(g_Levels, sz + 2);

   g_Levels[sz  ] = BuildLevel(w[0].high, w[0].time, true,  "PWH");
   g_Levels[sz+1] = BuildLevel(w[0].low,  w[0].time, false, "PWL");
  }

//--- Уровни Азиатской сессии (High/Low)
void AppendAsianLevels()
  {
   // Ищем максимум и минимум за Азиатскую сессию (19:00-22:00 EST)
   MqlRates h1[];
   ArraySetAsSeries(h1, true);
   // Берём 36 часовых баров, чтобы точно захватить вчерашнюю азиатскую сессию
   if(CopyRates(_Symbol, PERIOD_H1, 0, 36, h1) < 24) return;

   double asHigh = -DBL_MAX;
   double asLow  =  DBL_MAX;
   datetime asTime = 0;

   int utcStart = ESTtoUTC(Asian_Start_EST) % 24;
   int utcEnd   = ESTtoUTC(Asian_End_EST)   % 24;

   for(int i = 1; i < 36; i++)
     {
      MqlDateTime dt;
      TimeToStruct(h1[i].time, dt);
      int hr = dt.hour;
      bool inSession = HourInRange(hr, utcStart, utcEnd);
      if(inSession)
        {
         if(h1[i].high > asHigh) { asHigh = h1[i].high; asTime = h1[i].time; }
         if(h1[i].low  < asLow)    asLow  = h1[i].low;
        }
     }

   if(asHigh == -DBL_MAX || asLow == DBL_MAX) return;

   int sz = ArraySize(g_Levels);
   ArrayResize(g_Levels, sz + 2);
   g_Levels[sz  ] = BuildLevel(asHigh, asTime, true,  "ASH");
   g_Levels[sz+1] = BuildLevel(asLow,  asTime, false, "ASL");

   Print("[LIQ] ASH=", DoubleToString(asHigh, _Digits),
         " ASL=", DoubleToString(asLow, _Digits));
  }

//--- Конструктор структуры уровня ликвидности
SLiquidityLevel BuildLevel(double px, datetime t, bool bsl, string lbl)
  {
   SLiquidityLevel lv;
   lv.price   = px;
   lv.time    = t;
   lv.isBSL   = bsl;
   lv.isSwept = false;
   lv.label   = lbl;
   return lv;
  }

//--- Обновление статуса активных FVG зон (MITIGATED / INVERTED)
void UpdateFVGStatus()
  {
   if(!g_FVG.orderPlaced || g_FVG.fvgHigh <= 0) return;

   MqlRates bars[];
   ArraySetAsSeries(bars, true);
   if(CopyRates(_Symbol, TimeFrame, 0, 3, bars) < 2) return;
   MqlRates &lb = bars[1];

   bool invalidated = false;
   if(g_FVG.direction == DIR_BULLISH)
     {
      // FVG бычий: цена полностью прошла вниз ниже нижней границы → закрыт
      if(lb.close < g_FVG.fvgLow)
        {
         g_FVG.status = FVG_MITIGATED;
         invalidated  = true;
         Print("[FVG] Бычий FVG закрыт (MITIGATED). Отмена ордера.");
        }
     }
   else
     {
      if(lb.close > g_FVG.fvgHigh)
        {
         g_FVG.status = FVG_MITIGATED;
         invalidated  = true;
         Print("[FVG] Медвежий FVG закрыт (MITIGATED). Отмена ордера.");
        }
     }

   if(invalidated) DeletePendingOrder();
  }

//--- Удаление отложенного ордера
void DeletePendingOrder()
  {
   if(g_FVG.pendingTicket > 0)
     {
      bool ok = g_Trade.OrderDelete(g_FVG.pendingTicket);
      if(!ok)
         Print("[ERROR] OrderDelete: ", g_Trade.ResultRetcode());
     }
   ResetTradeCycle();
  }

//--- Проверка существования отложенного ордера в системе
void ValidatePendingOrder()
  {
   if(g_FVG.pendingTicket == 0) return;

   // Если ордер не найден — позиция уже открыта или ордер исчез
   bool exists = false;
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(OrderGetTicket(i) == g_FVG.pendingTicket) { exists = true; break; }
     }

   if(!exists && !HasOpenPosition())
     {
      Print("[WARN] Отложенный ордер не найден и позиции нет. Сброс цикла.");
      ResetTradeCycle();
     }
  }


//+------------------------------------------------------------------+
//|         МОДУЛЬ 5b: ONNX PLACEHOLDER — ML ФИЛЬТР РЕЖИМА РЫНКА    |
//+------------------------------------------------------------------+
//
//  Функция предназначена для интеграции ONNX-модели (Random Forest или LSTM),
//  обученной на признаках волатильности/тренда для бинарной классификации:
//    true  = Трендовый рынок → торговля разрешена
//    false = Боковой рынок   → торговля заблокирована
//
//  Для активации: замените тело функции реальным ONNX-вызовом.
//  Пример интеграции оставлен в комментариях ниже.
bool EvaluateRegimeONNX()
  {
   //── АКТИВАЦИЯ ONNX (раскомментировать после обучения модели) ──────────
   //
   // static long hModel = INVALID_HANDLE;
   //
   // // Инициализируем модель один раз
   // if(hModel == INVALID_HANDLE)
   //   {
   //    hModel = OnnxCreateFromFile("Files\\regime_rf_xauusd.onnx", ONNX_DEFAULT);
   //    if(hModel == INVALID_HANDLE)
   //      {
   //       Print("[ONNX] Не удалось загрузить модель: ", GetLastError());
   //       return true;  // Fail-safe: разрешаем торговлю
   //      }
   //   }
   //
   // // Формируем входной вектор признаков
   // double atr[], adx[], rsi[];
   // CopyBuffer(g_hATR, 0, 1, 10, atr);
   // // ... остальные признаки
   //
   // float inputs[10];
   // inputs[0] = (float)atr[0];      // ATR нормализованный
   // inputs[1] = (float)(atr[0]/atr[9]);  // ATR тренд
   // // ... заполнить inputs[2..9]
   //
   // // Запуск модели
   // float output[1] = {0};
   // if(!OnnxRun(hModel, ONNX_NO_CONVERSION, inputs, output))
   //   {
   //    Print("[ONNX] Ошибка OnnxRun: ", GetLastError());
   //    return true;
   //   }
   //
   // bool isTrending = (output[0] > 0.5f);
   // Print("[ONNX] Режим рынка: ", isTrending ? "ТРЕНД" : "БОКОВИК",
   //       " (вероятность: ", DoubleToString(output[0], 3), ")");
   // return isTrending;
   //
   //─────────────────────────────────────────────────────────────────────

   // ЗАГЛУШКА: всегда возвращаем true (торговля разрешена)
   return true;
  }

//+------------------------------------------------------------------+
//|       МОДУЛЬ 5c: ВИЗУАЛИЗАЦИЯ ГРАФИЧЕСКИХ ОБЪЕКТОВ              |
//+------------------------------------------------------------------+

//--- Отрисовка прямоугольной зоны FVG
void DrawFVGZone(const SFVG &fvg)
  {
   string rectName = "FVG_R_" + IntegerToString(g_ObjSeq);
   string ceName   = "FVG_C_" + IntegerToString(g_ObjSeq++);

   color  zoneClr  = (fvg.direction == DIR_BULLISH) ? FVG_Bull_Color : FVG_Bear_Color;

   // Прямоугольник зоны FVG (растягиваем на 50 баров вправо)
   datetime t1 = fvg.formationTime;
   datetime t2 = fvg.formationTime + (datetime)(PeriodSeconds(TimeFrame) * 60);

   if(ObjectCreate(0, rectName, OBJ_RECTANGLE, 0,
                   t1, fvg.fvgHigh,
                   t2, fvg.fvgLow))
     {
      ObjectSetInteger(0, rectName, OBJPROP_COLOR,      zoneClr);
      ObjectSetInteger(0, rectName, OBJPROP_FILL,        true);
      ObjectSetInteger(0, rectName, OBJPROP_BACK,        true);
      ObjectSetInteger(0, rectName, OBJPROP_SELECTABLE,  false);
      ObjectSetInteger(0, rectName, OBJPROP_HIDDEN,      false);
      ObjectSetString (0, rectName, OBJPROP_TOOLTIP,
                       (fvg.direction == DIR_BULLISH ? "Bullish " : "Bearish ") +
                       "FVG [" + EnumToString(fvg.status) + "]" +
                       "\nH: " + DoubleToString(fvg.fvgHigh, _Digits) +
                       "\nL: " + DoubleToString(fvg.fvgLow, _Digits) +
                       "\nCE: " + DoubleToString(fvg.ce50, _Digits));
     }
   else
      Print("[DRAW] Ошибка создания FVG прямоугольника: ", GetLastError());

   // Пунктирная линия уровня CE (Consequent Encroachment 50%)
   DrawHLine(ceName, fvg.ce50, clrWhite, STYLE_DOT, 1);
   ObjectSetString(0, ceName, OBJPROP_TOOLTIP,
                   "CE 50%: " + DoubleToString(fvg.ce50, _Digits));

   ChartRedraw(0);
  }

//--- Отрисовка горизонтальной линии
void DrawHLine(const string    name,
               const double    price,
               const color     clr,
               const ENUM_LINE_STYLE style,
               const int       width)
  {
   // Удаляем старый объект с таким именем, если существует
   if(ObjectFind(0, name) >= 0) ObjectDelete(0, name);

   if(ObjectCreate(0, name, OBJ_HLINE, 0, 0, price))
     {
      ObjectSetInteger(0, name, OBJPROP_COLOR,     clr);
      ObjectSetInteger(0, name, OBJPROP_STYLE,     style);
      ObjectSetInteger(0, name, OBJPROP_WIDTH,     width);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetString (0, name, OBJPROP_TOOLTIP,
                       name + ": " + DoubleToString(price, _Digits));
     }
  }

//--- Отрисовка всех уровней ликвидности
void RenderLiquidityLines()
  {
   // Сначала чистим старые уровни, чтобы не накапливались
   int total = ObjectsTotal(0, 0, -1);
   for(int i = total - 1; i >= 0; i--)
     {
      string nm = ObjectName(0, i, 0, -1);
      if(StringFind(nm, "LIQ_") == 0)
         ObjectDelete(0, nm);
     }

   int n = ArraySize(g_Levels);
   for(int i = 0; i < n; i++)
     {
      if(g_Levels[i].isSwept) continue;  // Захваченные уровни не рисуем

      string lineName = "LIQ_" + g_Levels[i].label + "_" + IntegerToString(i);
      DrawHLine(lineName, g_Levels[i].price, Liq_Color, STYLE_DASH, 2);

      // Текстовая метка справа от линии
      string txtName = "LIQ_T_" + IntegerToString(i);
      if(ObjectFind(0, txtName) >= 0) ObjectDelete(0, txtName);

      datetime lblTime = iTime(_Symbol, TimeFrame, 0) + PeriodSeconds(TimeFrame) * 2;
      if(ObjectCreate(0, txtName, OBJ_TEXT, 0, lblTime, g_Levels[i].price))
        {
         ObjectSetString (0, txtName, OBJPROP_TEXT,      g_Levels[i].label);
         ObjectSetInteger(0, txtName, OBJPROP_COLOR,     Liq_Color);
         ObjectSetInteger(0, txtName, OBJPROP_FONTSIZE,  7);
         ObjectSetInteger(0, txtName, OBJPROP_SELECTABLE, false);
        }
     }

   ChartRedraw(0);
  }

//--- Удаление всех объектов советника с графика
void PurgeChartObjects()
  {
   string prefixes[] = {"FVG_R_", "FVG_C_", "LIQ_", "CISD_B_", "CISD_R_"};
   int total;

   for(int p = 0; p < ArraySize(prefixes); p++)
     {
      total = ObjectsTotal(0, 0, -1);
      for(int i = total - 1; i >= 0; i--)
        {
         string nm = ObjectName(0, i, 0, -1);
         if(StringFind(nm, prefixes[p]) == 0)
            ObjectDelete(0, nm);
        }
     }
   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//|             ВСПОМОГАТЕЛЬНЫЕ И УТИЛИТАРНЫЕ ФУНКЦИИ               |
//+------------------------------------------------------------------+

//--- Проверка наличия открытой позиции по текущему символу + Magic
bool HasOpenPosition()
  {
   if(!PositionSelect(_Symbol)) return false;
   return (PositionGetInteger(POSITION_MAGIC) == Magic);
  }

//--- Сброс торгового цикла в начальное состояние
void ResetTradeCycle()
  {
   ZeroMemory(g_Sweep);
   ZeroMemory(g_CISD);
   ZeroMemory(g_FVG);
   g_PartialDone = false;
   g_CyclePhase  = PHASE_HUNTING;
   Print("[RESET] Торговый цикл сброшен → PHASE_HUNTING");
  }

//--- Количество баров, прошедших с указанного времени
int BarsElapsed(const datetime fromTime)
  {
   if(fromTime == 0) return 999;
   return Bars(_Symbol, TimeFrame, fromTime, TimeCurrent());
  }

//+------------------------------------------------------------------+
//|                    КОНЕЦ ФАЙЛА                                   |
//|            SMC_UltimateTrader_2026.mq5                           |
//+------------------------------------------------------------------+
