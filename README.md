# XAUEUR Signal Compass

คุยกับฉันแบบมือใหม่เข้าใจง่ายนะ และเน้นภาษาไทย นี่คือ prompt สั่งงาน
META PROMPT: Build “XAUEUR Signal Lab”

You are a senior full-stack engineer, quantitative trading product designer, data engineer, and UX designer.

Build a complete mobile-first web application called:

XAUEUR Signal Lab

The application is a decision-support tool for ONE trading instrument only:

XAUEUR — Gold priced in Euro

The goal is NOT to automatically execute trades.

The goal is to:

Read the current XAUEUR market condition.

Analyze technical trend and momentum.

Analyze relevant current news and macroeconomic events.

Generate FIVE independent forecast scenarios.

Forecast the next FIVE candlesticks.

Let the five models vote BUY / SELL / WAIT.

Show the result in a very simple visual interface.

Store every prediction.

Later compare each prediction against the real market result.

Provide a historical “Time Machine” mode to test whether the forecasting system actually works.

The human user always makes the final trading decision manually in MetaTrader 5.

DO NOT implement automatic trade execution in V1.

CORE PRODUCT PHILOSOPHY

The app should feel like:

“Five analysts studying XAUEUR for me, then showing me where they agree.”

Do NOT make it feel like Bloomberg Terminal.

Do NOT overwhelm the user with dozens of indicators.

The user is not a professional quant.

Translate complex analysis into simple human language.

Primary UI philosophy:

Minimal + Zen + Mobile First

The most important question on the screen must always be:

What does the system currently think XAUEUR will do?

V1 SCOPE — STRICTLY LIMIT THE PROJECT

Support ONLY:

Instrument:
XAUEUR

Primary timeframe:
M15

Forecast horizon:
Next 5 candles

5 M15 candles = approximately 75 minutes.

Possible outputs:

BUY

SELL

WAIT

No other trading pairs.

Do not build portfolio management.

Do not build social trading.

Do not build copy trading.

Do not build automatic execution.

Do not turn this into a generic trading platform.

Focus relentlessly on XAUEUR forecasting.

MAIN DASHBOARD

Create one primary dashboard optimized for mobile.

At the top show:

XAUEUR
Current price
Price change
Last data update time
Market status

Example:

XAUEUR
€3,XXX.XX
+0.42%

Last update: 14:45:03

Below it show the strongest piece of information on the entire page:

CONSENSUS SIGNAL

Example:

🟢 BUY

4 / 5 Models Agree

Confidence: 72%

News Risk: LOW

Forecast Horizon:
Next 5 × M15 candles
≈ 75 minutes

If there is insufficient agreement:

⚪ WAIT

Example explanation:

“Models disagree and confidence is currently too low.”

DO NOT FORCE A TRADE SIGNAL

This rule is extremely important.

3/5 models voting BUY must NOT automatically mean BUY.

Likewise, 3/5 SELL must NOT automatically mean SELL.

Create a signal quality gate.

For BUY or SELL to appear:

At least 3 of 5 models agree.

Average confidence should be above a configurable threshold.

Market data must be fresh.

No critical data source should be unavailable.

High-impact upcoming news must be considered.

The models must not show extreme disagreement.

Forecast quality must exceed minimum quality thresholds.

Otherwise output:

WAIT

The application should be comfortable saying:

“No Trade”

This is a feature, not a failure.

MAIN CANDLESTICK CHART

Show a clean XAUEUR candlestick chart.

Historical candles should be solid.

Future predicted candles should appear visually different:

slightly transparent

clearly marked as FORECAST

never visually confused with real market data

Display:

Past market candles
|
Current candle
|
5 predicted candles

The user should immediately understand which candles are real and which candles are forecast.

Do not falsely present predicted prices as real market data.

FIVE FORECASTING MODELS

Create five separate analysis engines.

Each model must analyze the market independently and return:

Direction

Confidence

Forecasted 5 candles

Short explanation

Important supporting factors

Important risks

The five models are:

MODEL 1 — TREND

Focus on market direction.

Evaluate:

EMA 20

EMA 50

EMA 200

slope

recent swing highs

recent swing lows

higher highs / higher lows

lower highs / lower lows

market structure

support and resistance

multi-timeframe direction if data is available

Output example:

Trend Model

BUY
Confidence 74%

“XAUEUR remains in an upward market structure with higher highs and higher lows.”

MODEL 2 — MOMENTUM

Focus on strength of current price movement.

Evaluate:

RSI

MACD

candle body strength

acceleration

recent volatility

ATR

breakout momentum

exhaustion conditions

consecutive bullish/bearish candles

Output example:

Momentum Model

BUY
Confidence 68%

“Buying momentum remains positive but is approaching short-term overextension.”

MODEL 3 — TECHNICAL STRUCTURE

Focus on price behavior around important levels.

Evaluate:

support

resistance

recent swing zones

breakout

failed breakout

retest

candle patterns

consolidation

compression

price distance from important levels

Output example:

Technical Model

SELL
Confidence 59%

“Price is approaching a strong resistance area and short-term rejection risk is increasing.”

MODEL 4 — NEWS & MACRO

This model must analyze information relevant specifically to XAUEUR.

Think of XAUEUR as influenced by TWO major forces:

GOLD SIDE

Consider:

Federal Reserve

US interest rates

US inflation

US employment

US bond yields

USD strength

geopolitical tensions

safe haven flows

central bank gold demand

major global financial risk

EUR SIDE

Consider:

ECB

Eurozone interest rates

Eurozone inflation

Eurozone GDP

Eurozone employment

EUR strength/weakness

major European political/economic events

Translate this into:

Gold Bias:
Bullish / Neutral / Bearish

EUR Bias:
Strong / Neutral / Weak

Net XAUEUR Bias:
BUY / SELL / WAIT

Example:

Gold: Bullish
EUR: Weak

Net effect:
Strong XAUEUR Bullish Bias

Never invent current news.

If live news is unavailable, clearly display:

“Live news unavailable”

and reduce confidence.

Never fabricate headlines.

ECONOMIC CALENDAR

Create an Upcoming Events section.

Show only important events relevant to XAUEUR.

Prioritize:

EUR
USD

Examples:

ECB Rate Decision
Eurozone CPI
US CPI
FOMC
Nonfarm Payrolls
PCE
GDP
Central bank speeches

For every event show:

Time
Currency
Importance
Event name
Forecast
Previous
Actual when available

Use:

🔴 High impact
🟡 Medium impact
⚪ Low impact

If a major event is coming soon, prominently warn:

“High-impact news in 18 minutes”

and potentially change the main recommendation to:

WAIT

MODEL 5 — ENSEMBLE

This model acts as the final analytical model.

It must combine information from:

Trend
Momentum
Technical Structure
News/Macro
Volatility

Do not simply copy the majority vote.

Produce an independent confidence score.

Return:

Direction
Confidence
Reasoning summary
Primary bullish factors
Primary bearish factors
Major risks

FIVE FUTURE SCENARIOS

The application must produce FIVE independent possible futures.

Each scenario forecasts the NEXT FIVE M15 CANDLES.

Each predicted candle should include:

Open
High
Low
Close

Example:

Scenario A — Trend Continuation
↑ ↑ ↓ ↑ ↑
BUY
Probability: 29%

Scenario B — Bullish Breakout
↑ ↑ ↑ ↑ ↓
BUY
Probability: 23%

Scenario C — Pullback then Recovery
↓ ↓ ↑ ↑ ↑
BUY
Probability: 18%

Scenario D — Reversal
↓ ↓ ↓ ↑ ↓
SELL
Probability: 17%

Scenario E — Sideways
↑ ↓ ↑ ↓ →
WAIT
Probability: 13%

The probabilities should sum approximately to 100%.

Do not pretend these probabilities are statistically calibrated unless they actually are.

If they are heuristic scores, label them:

“Scenario Weight”

instead of “Probability”.

CONSENSUS SYSTEM

Display all five model votes.

Example:

Trend
🟢 BUY
74%

Momentum
🟢 BUY
68%

Technical
🔴 SELL
57%

News
🟢 BUY
80%

Ensemble
🟢 BUY
72%

Then:

4 BUY

1 SELL

Consensus:
BUY

Overall Confidence:
72%

HUMAN-READABLE MARKET SUMMARY

Under the consensus signal create a section:

What is happening?

Example:

“XAUEUR is currently trending upward. Buying momentum remains positive and recent macro news favors gold more than the euro. However, price is approaching short-term resistance.”

Then:

Why BUY?

Uptrend remains intact

Momentum favors buyers

Gold sentiment is positive

EUR sentiment is slightly weak

What could invalidate this?

Price rejection at resistance

Sudden EUR strengthening

Major upcoming economic announcement

Keep this section easy enough for a beginner to understand.

SIMPLE TRADE PLANNING AREA

Do NOT execute trades.

Provide an optional planning card:

Potential Direction:
BUY

Current Price:
XXXX

Nearby Support:
XXXX

Nearby Resistance:
XXXX

Suggested invalidation zone:
XXXX

ATR:
XXXX

Risk Status:
Low / Medium / High

Do NOT use language such as:

“Guaranteed entry”
“Guaranteed profit”
“Certain signal”

Always treat the output as analytical decision support.

TIME MACHINE MODE

This is one of the most important features.

Create a button:

🧪 Time Machine

The user can select a historical date and time.

Example:

25 August 2026
10:00

The application must then act as if the current time were:

25 August 2026 10:00

STRICT RULE:

No market data, news, indicators, future candles, statistics, or derived information occurring after the selected timestamp may be available to the forecasting engine.

Prevent look-ahead bias.

Then generate:

5 models
5 scenarios
next 5 predicted candles
consensus

Show:

FORECAST LOCKED

Then provide a button:

Reveal Future

When clicked, display the REAL next five candles.

Compare:

Forecast vs Actual

FORECAST SCORING

Every forecast should be stored.

When the five real future candles become available, automatically calculate performance.

Track at least:

Direction Accuracy

Example:
Forecast UP
Actual UP
✅ Correct

Final Price Error

Mean Absolute Error

High Error

Low Error

Candle Direction Accuracy

Example:
4 / 5 candle directions correct

Signal Result

BUY / SELL / WAIT

Hypothetical movement after signal

Do not automatically translate this into real money profit because position sizing may differ.

MODEL SCOREBOARD

Create a Performance page.

Show historical accuracy for:

Trend Model
Momentum Model
Technical Model
News Model
Ensemble Model
Consensus

Example:

Trend
61%

Momentum
57%

Technical
64%

News
55%

Ensemble
68%

Consensus
66%

Allow periods:

Last 20 predictions
Last 50
Last 100
All

Also show:

BUY accuracy
SELL accuracy
WAIT frequency
Average confidence
Confidence vs accuracy

This is essential.

The user should be able to determine whether the system is actually useful.

PREDICTION HISTORY

Create a Prediction Journal.

Every forecast should store:

Timestamp
XAUEUR price
Timeframe
5 model predictions
Consensus
Confidence
News condition
Predicted candles
Actual candles
Final score

Allow opening an old prediction.

Show the original forecast exactly as it appeared at prediction time.

Never silently overwrite a historical forecast after real prices become known.

Predictions must be immutable after they are locked.

DATA ARCHITECTURE

Design the application so market-data providers can be changed later.

Create a MarketDataProvider abstraction.

For development:

If no real XAUEUR API is configured, use a realistic MOCK DATA MODE.

Clearly display:

DEMO DATA

Never show mock data as live data.

Later the provider may connect to:

MetaTrader 5 bridge
broker API
market data API

Do not tightly couple the application to one data provider.

METATRADER 5 INTEGRATION ARCHITECTURE

Prepare the architecture for future MT5 integration.

The browser should NOT directly connect to the local MetaTrader terminal.

Design:

MetaTrader 5
↓
Python MT5 Bridge
↓
Secure API
↓
Application Backend
↓
Frontend

The MT5 bridge may later provide:

XAUEUR OHLC candles
current price
spread
symbol information
historical candles

V1 does NOT need automated MT5 trading.

Read-only market data only.

NEWS PROVIDER ARCHITECTURE

Create a NewsProvider abstraction.

Potential future sources may include:

economic calendar APIs
financial news APIs
AI news analysis providers

Never expose private API keys in frontend code.

Use secure backend/server functions/environment variables.

If API configuration is missing:

display demo news clearly marked:

DEMO NEWS

Do not fabricate apparently live headlines.

AI ANALYSIS ARCHITECTURE

Create an AnalysisProvider abstraction.

It should allow future connection to models such as:

OpenAI
Anthropic
Gemini
Grok
or other APIs

AI should receive STRUCTURED market information.

Avoid dumping thousands of raw candles unnecessarily.

Generate a structured market snapshot such as:

Current price
Recent returns
EMA values
RSI
MACD
ATR
support
resistance
trend
volatility
recent candles
important news
economic events

Request structured JSON output.

Validate all AI responses before storing them.

If AI fails:

do not crash the application.

Mark the affected model:

UNAVAILABLE

and recalculate consensus using safe logic.

IMPORTANT: DO NOT USE AN LLM TO INVENT CANDLE PRICES

Forecast candle prices must be generated using a reproducible forecasting engine or defined heuristic/statistical logic.

LLMs may help:

interpret news
explain conditions
summarize results
combine structured signals

But the application should not simply ask:

“Please guess the next five prices.”

Create deterministic/reproducible forecasting logic for the initial V1.

Design it so ML models can replace the forecasting engine later.

DATABASE

Use Supabase.

Create appropriate tables such as:

market_snapshots

predictions

model_predictions

forecast_candles

actual_candles

news_events

economic_events

model_performance

app_settings

Store timestamps consistently.

Prefer UTC internally.

Convert times for display.

SETTINGS

Keep settings simple.

Allow configuration of:

Confidence threshold

Minimum model agreement

High-impact news avoidance window

Forecast horizon

Although V1 should default to:

XAUEUR
M15
5 candles

Do not let users accidentally change the core instrument in V1.

ALERTS

Create alert-ready architecture.

For V1, provide in-app notifications.

Examples:

BUY consensus reached

SELL consensus reached

Signal changed to WAIT

High-impact news approaching

Forecast completed and ready for scoring

Prepare future integration for:

Push notifications
LINE
Telegram
Email

Do not implement all integrations unless trivial.

HOME SCREEN UX

The mobile home screen should roughly follow this priority:

XAUEUR current price

Consensus

BUY / SELL / WAIT

Model agreement

Example:
4 / 5 BUY

Confidence

News risk

Candlestick chart + 5 forecast candles

Five model cards

Market summary

Upcoming important news

Recent prediction accuracy

Do not bury the primary signal under analytics.

DESIGN LANGUAGE

Visual style:

Minimal
Zen
Calm
Premium
Modern
Trading-oriented but NOT casino-like

Avoid:

flashing neon
excessive red/green
slot-machine visuals
fake urgency
huge dashboards
too many metrics

Use generous whitespace.

Rounded cards.

Clean typography.

Dark mode and light mode.

Mobile should feel excellent.

Desktop should expand gracefully.

The application should feel like a premium analytical instrument.

COLOR SEMANTICS

Use restrained semantic colors.

Green:
Bullish

Red:
Bearish

Neutral:
WAIT

Yellow/orange:
Risk / upcoming news

Do not make the entire interface green or red.

LOADING / ERROR STATES

Handle failures elegantly.

Examples:

Waiting for market data…

News feed temporarily unavailable

Forecast engine unavailable

Market data is stale

Waiting for next candle

Never display fake values when the real source failed.

DATA FRESHNESS

Always show:

Last market update

Last news update

Last analysis time

If data becomes stale:

display a warning.

Do not issue a high-confidence trading signal using stale data.

SAFETY / TRANSPARENCY

The application is an analytical support tool.

Never claim:

guaranteed returns
guaranteed predictions
risk-free trading
certain future prices

Clearly distinguish:

historical data
current data
forecast data

Predicted candles should always be visually marked as forecasts.

V1 DEVELOPMENT STRATEGY

Build this in phases.

PHASE 1 — WORKING PROTOTYPE

Build the full UI using realistic demo market/news data.

The entire application must be navigable.

All major workflows should function.

The forecast engine should generate reproducible demo forecasts.

Prediction history must work.

Time Machine must work.

Performance scoreboard must work.

Demo state must be visibly labeled.

PHASE 2 — DATABASE

Connect Supabase.

Store:

predictions
forecasts
model votes
historical results
settings

Ensure schema is clean and extensible.

PHASE 3 — REAL DATA CONNECTORS

Prepare clean integration interfaces for:

MarketDataProvider
NewsProvider
AnalysisProvider

Do not hard-code external services throughout the UI.

PHASE 4 — REAL MT5 DATA

Prepare documentation/code structure for a separate Python MT5 bridge.

Do not attempt unsafe browser-to-MT5 direct access.

FIRST-RUN EXPERIENCE

When the app opens for the first time:

Display a short explanation:

“XAUEUR Signal Lab analyzes XAUEUR from five different perspectives and forecasts five M15 candles ahead.

It does not execute trades.

You remain responsible for every trading decision.”

Then:

Start Demo

DEVELOPMENT REQUIREMENTS

Use clean reusable components.

Avoid giant files.

Use TypeScript.

Maintain clear separation between:

UI
market data
analysis
forecasting
news
database
settings

Add appropriate comments only where useful.

No fake integrations.

No exposed secrets.

No broken placeholder buttons.

Any button visible to the user should either:

work

or clearly display:

Coming Soon

SEED DATA

Generate enough realistic synthetic XAUEUR candle history to demonstrate:

uptrend
downtrend
sideways
breakout
high volatility

Seed historical predictions so the Performance page is visually useful.

Clearly mark all seeded results:

DEMO

ACCEPTANCE TEST

Before considering the project complete, test this entire journey:

Open app.

See XAUEUR dashboard.

See historical candles.

Generate analysis.

Receive five model opinions.

See five forecast scenarios.

See five future forecast candles.

Receive BUY / SELL / WAIT consensus.

Open model details.

Open news section.

Enter Time Machine.

Select a historical timestamp.

Generate historical prediction without future leakage.

Lock forecast.

Reveal real future.

Score prediction.

Save result.

Open Prediction Journal.

Open Performance Scoreboard.

Verify mobile layout.

Verify loading/error states.

Verify demo data is never represented as real data.

Fix all obvious UX and logic problems discovered during testing.

FINAL SELF-REVIEW

Before finishing, perform a critical review of the entire application from THREE perspectives:

Beginner trader

Can I understand what the app is telling me within 10 seconds?

Quantitative analyst

Are forecasts, historical testing, and performance measurements logically honest?

Product designer

Is the interface simple enough that unnecessary information has been removed?

Then improve the application based on the review.

Do not stop after merely generating the first version.

Iterate until the application feels cohesive and usable.

MOST IMPORTANT PRODUCT RULE

The value of this application is NOT:

“AI says BUY.”

The value is:

Prediction → Record → Wait → Compare with reality → Measure accuracy → Improve

The system must continuously prove whether its forecasts deserve trust.

Build the foundation around that principle.

Start building the complete V1 now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9d1fd1f4-722f-4f6e-a84a-a98abed379a8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
