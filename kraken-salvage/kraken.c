/*
 * KRAKEN SALVAGE CO. -- 1986 Edition
 *
 *   A terminal-based maritime salvage management game.
 *   Build a thriving underwater metropolis from foundering ships
 *   while staying just barely on the lawful side of civilization.
 *
 * Build:   make
 *   or:    cc -O2 -Wall -o kraken kraken.c
 * Run:     ./kraken
 *
 * Requires an ANSI-capable terminal (xterm, Linux console, modern Mac/Win).
 * No external dependencies beyond the C standard library.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>
#include <stdint.h>

/* ------------------------------------------------------------------ */
/*  ANSI escape codes                                                  */
/* ------------------------------------------------------------------ */
#define CLS    "\x1b[2J\x1b[H"
#define RST    "\x1b[0m"
#define B      "\x1b[1m"
#define D      "\x1b[2m"
#define FRED   "\x1b[31m"
#define FGRN   "\x1b[32m"
#define FYEL   "\x1b[33m"
#define FBLU   "\x1b[34m"
#define FMAG   "\x1b[35m"
#define FCYN   "\x1b[36m"
#define FWHT   "\x1b[37m"
#define FGRY   "\x1b[90m"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
#define MAX_TURNS  25
#define WIN_POP    400
#define WIN_REP    70

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
typedef struct {
    int steel;        /* salvage steel              */
    int wealth;       /* cargo wealth (gold)        */
    int reputation;   /* 0..100                     */
    int morale;       /* 0..100                     */
    int pressure;     /* 0..100  (oxygen/pressure)  */
    int scrutiny;     /* 0..100  (insurance heat)   */
    int population;   /*                            */
    int casualties;   /* lifetime, used for endings */
    int turn;
    int capacity;     /* max ships per turn         */
} City;

typedef struct {
    int apartments;
    int docks;
    int refineries;
    int police;
    int seafood;
    int office;
    int hotel;
} Districts;

typedef struct {
    int digory;
    int funny;
    int mitt;
    int firebot;
} Crew;

typedef struct {
    int diff_idx;
    City c;
    Districts d;
    Crew crew;
    int salvaged;
    int rescued;
    int sabotaged;
    int last_misdirect_turn;
    int sovereign;     /* legal recognition unlocked */
    int game_over;
    const char *over_reason;
} Game;

typedef struct {
    const char *name;
    int starting_steel;
    int starting_wealth;
    int starting_rep;
    int starting_scrutiny;
    int starting_pop;
} Difficulty;

static const Difficulty DIFFS[] = {
    { "Cabin Boy   (easy)",   120, 220, 65,  0,  20 },
    { "First Mate  (medium)",  60, 120, 55, 10,  10 },
    { "Captain     (hard)",    30,  60, 50, 25,   5 },
};
#define DIFF_COUNT ((int)(sizeof(DIFFS)/sizeof(DIFFS[0])))

/* Vessel types in detection priority order */
typedef enum {
    VES_FISHING = 0,
    VES_CARGO,
    VES_PIRATE,
    VES_LINER,
    VES_CONTAINER,
    VES_TANKER,
    VES_RESEARCH,
    VES_COUNT
} VesselType;

typedef struct {
    const char *name;
    int steel_lo, steel_hi;
    int wealth_lo, wealth_hi;
    int crew;
    int rescue_pop;     /* pop gained on full rescue */
    int sabotage_haz;   /* hazard amplifier (0..6)   */
    int civilian;       /* 1 = scrutinized victim    */
    int special;        /* 1 = research vessel       */
    char glyph;
} VesselSpec;

static const VesselSpec VES[VES_COUNT] = {
    /* name              st_lo st_hi w_lo w_hi crw pop hz cv sp gl */
    { "Fishing Trawler",   5,  15,   10,  25,   6,  4, 1, 1, 0, 'f' },
    { "Cargo Schooner",   15,  30,   30,  60,  12,  8, 1, 1, 0, 's' },
    { "Pirate Frigate",   25,  50,   20,  80,  18,  0, 0, 0, 0, 'P' },
    { "Luxury Liner",     20,  40,  100, 200,  80, 40, 4, 1, 0, 'L' },
    { "Container Ship",   60, 120,   40,  90,  22, 10, 2, 1, 0, 'C' },
    { "Oil Tanker",       40,  80,   60, 140,  16,  8, 6, 1, 0, 'T' },
    { "Research Vessel",  25,  45,   50, 100,  14,  8, 3, 1, 1, 'R' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
static int  rnd(int lo, int hi) { return lo + rand() % (hi - lo + 1); }
static int  chance(int pct)     { return (rand() % 100) < pct; }
static int  clampi(int v, int lo, int hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}
static void clamp_city(City *c) {
    c->reputation = clampi(c->reputation, 0, 100);
    c->morale     = clampi(c->morale,     0, 100);
    c->pressure   = clampi(c->pressure,   0, 100);
    c->scrutiny   = clampi(c->scrutiny,   0, 100);
    if (c->steel    < 0) c->steel    = 0;
    if (c->wealth   < 0) c->wealth   = 0;
    if (c->population < 0) c->population = 0;
}

static void pause_for_key(void) {
    char buf[64];
    printf("\n" D "  -- press ENTER to continue --" RST);
    fflush(stdout);
    if (!fgets(buf, sizeof(buf), stdin)) exit(0);
}

static int read_choice(int lo, int hi) {
    char buf[64];
    int v;
    for (;;) {
        printf(B "  > " RST);
        fflush(stdout);
        if (!fgets(buf, sizeof(buf), stdin)) exit(0);
        /* Skip leading whitespace */
        char *p = buf;
        while (*p && isspace((unsigned char)*p)) p++;
        if (*p == 0) continue;
        v = atoi(p);
        if (v >= lo && v <= hi) return v;
        printf(FRED "    Try a number from %d to %d." RST "\n", lo, hi);
    }
}

/* Bar like: [#####.....] 50% */
static void bar(const char *label, int v, int max, const char *color) {
    int width = 16;
    int filled = (max > 0) ? (v * width) / max : 0;
    if (filled > width) filled = width;
    if (filled < 0) filled = 0;
    int pct = (max > 0) ? (v * 100) / max : 0;
    printf("%s%-10s" RST " %s[", FWHT, label, color);
    for (int i = 0; i < filled; i++) putchar('#');
    for (int i = filled; i < width; i++) putchar('.');
    printf("]" RST " %3d%%", pct);
}

/* ------------------------------------------------------------------ */
/*  Title screen                                                       */
/* ------------------------------------------------------------------ */
static void title_screen(void) {
    printf(CLS);
    printf("\n");
    printf(FCYN "       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n" RST);
    printf(FCYN "      ~~~  " B FYEL "K R A K E N   S A L V A G E   C o ." RST FCYN "  ~~~\n" RST);
    printf(FCYN "       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n" RST);
    printf("\n");
    printf(FMAG "                          .-\"\"\"\"\"\"-.\n" RST);
    printf(FMAG "                         /  o    o  \\\n" RST);
    printf(FMAG "                        |     /\\     |\n" RST);
    printf(FMAG "                        |    '--'    |\n" RST);
    printf(FMAG "                         \\          /\n" RST);
    printf(FMAG "                          '-..__..-'\n" RST);
    printf(FMAG "                       __/  /||\\  \\__\n" RST);
    printf(FMAG "                  __,-' .--' || '--. '-,__\n" RST);
    printf(FMAG "               ,-~ _.-~ /~~  ||  ~~\\  ~-._ ~-,\n" RST);
    printf(FMAG "              (__,-~  ./    /||\\    \\.   ~-,__)\n" RST);
    printf(FMAG "                  /~~~  __,-~  ~-,__   ~~~\\\n" RST);
    printf(FBLU "        ~~~~~  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ~~~~~\n" RST);
    printf(FBLU "    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n" RST);
    printf("\n");
    printf("           " D "\"Mostly Legal Maritime Recycling, est. 1886\"" RST "\n");
    printf("\n");
    printf("                  " FYEL "[1]" RST " New Game        "
                              FYEL "[2]" RST " About\n");
    printf("                  " FYEL "[3]" RST " Quit\n\n");
}

static void about_screen(void) {
    printf(CLS);
    printf(B FYEL "  KRAKEN SALVAGE CO." RST "\n");
    printf("  ----------------------------------------------------------\n");
    printf("  You are the Kraken: an ageless cephalopod administrator of\n");
    printf("  an underwater metropolis built from the bones of foundering\n");
    printf("  ships. Civilians are saved (mostly). Cargo is recycled\n");
    printf("  (always). The tentacles, as ever, work in mysterious ways.\n\n");
    printf("  " B "Each turn:" RST "\n");
    printf("    - Sonar detects vessels in distress.\n");
    printf("    - You choose: rescue, salvage, sabotage, or ignore.\n");
    printf("    - A random event tests your city's resilience.\n");
    printf("    - You build districts to grow population & capacity.\n\n");
    printf("  " B "Win:" RST "  Reach population %d with reputation >= %d%%\n",
           WIN_POP, WIN_REP);
    printf("  " B "Lose:" RST " Insurance scrutiny hits 100%%; the city's\n");
    printf("        pressure or morale collapses; or %d turns elapse\n", MAX_TURNS);
    printf("        without victory.\n\n");
    printf("  Tip: refineries make steel, seafood districts make wealth,\n");
    printf("       squid police suppress scrutiny. Don't get greedy.\n\n");
    pause_for_key();
}

/* ------------------------------------------------------------------ */
/*  Difficulty select                                                  */
/* ------------------------------------------------------------------ */
static int select_difficulty(void) {
    printf(CLS);
    printf(B FYEL "  CHOOSE YOUR RANK\n" RST);
    printf("  --------------------------------------------------\n\n");
    for (int i = 0; i < DIFF_COUNT; i++) {
        const Difficulty *d = &DIFFS[i];
        printf("    " FYEL "[%d]" RST "  %s\n", i+1, d->name);
        printf("         steel %d  wealth %d  rep %d%%  scrutiny %d%%\n\n",
               d->starting_steel, d->starting_wealth,
               d->starting_rep, d->starting_scrutiny);
    }
    return read_choice(1, DIFF_COUNT) - 1;
}

/* ------------------------------------------------------------------ */
/*  City status display                                                */
/* ------------------------------------------------------------------ */
static int total_districts(const Districts *d) {
    return d->apartments + d->docks + d->refineries +
           d->police + d->seafood + d->office + d->hotel;
}

static void print_districts(const Districts *d, const Crew *crew) {
    int n = total_districts(d);
    printf("  " B FCYN "  KRAKEN CITY -- districts: %d" RST "\n", n);
    /* Tiny ASCII layout of the city floor */
    printf("    " FBLU "~  ~  ~     ~     ~  ~  ~     ~     ~  ~  ~\n" RST);
    int row = 0;
    char buf[256];
    int len = 0;
    buf[0] = 0;
    #define ADD(ch, n) do { for (int _i=0;_i<(int)(n);_i++) { \
        len += snprintf(buf+len, sizeof(buf)-len, "[" FYEL "%c" RST "]", (ch)); \
        if (++row >= 12) { printf("    %s\n", buf); buf[0]=0; len=0; row=0; } } } while(0)

    ADD('A', d->apartments);
    ADD('D', d->docks);
    ADD('R', d->refineries);
    ADD('S', d->police);
    ADD('F', d->seafood);
    ADD('O', d->office);
    ADD('H', d->hotel);
    if (row > 0) printf("    %s\n", buf);
    if (n == 0) printf("    " D "  (just bare bedrock and tentacles)" RST "\n");
    #undef ADD

    printf("    " FBLU "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n" RST);
    printf("    " D "A=Apartments D=Docks R=Refinery S=Squid-Police\n");
    printf("    F=Seafood O=Office H=Digory's Hotel" RST "\n");

    /* Crew roster */
    printf("    Advisors:");
    if (crew->digory)  printf(FYEL " Digory" RST);
    if (crew->funny)   printf(FMAG " Funny" RST);
    if (crew->mitt)    printf(FRED " Mitt" RST);
    if (crew->firebot) printf(FCYN " Fireplace-Robot" RST);
    if (!crew->digory && !crew->funny && !crew->mitt && !crew->firebot)
        printf(D " (none yet)" RST);
    printf("\n");
}

static void status_header(const Game *g) {
    const City *c = &g->c;
    printf(CLS);
    printf(B FYEL
        "================ KRAKEN SALVAGE CO. -- TURN %2d / %2d ================\n"
        RST, c->turn, MAX_TURNS);
    printf(" " FYEL "Steel:" RST   " %4d   "
           FYEL "Wealth:" RST  " $%-5d  "
           FYEL "Pop:" RST     " %4d   "
           FYEL "Capacity:" RST " %d/turn\n",
           c->steel, c->wealth, c->population, c->capacity);
    printf(" "); bar("Reputation", c->reputation, 100,
                    c->reputation >= 60 ? FGRN :
                    c->reputation >= 35 ? FYEL : FRED);
    printf("   ");
    bar("Morale",     c->morale,     100,
        c->morale >= 50 ? FGRN : c->morale >= 25 ? FYEL : FRED);
    printf("\n");
    printf(" "); bar("Pressure",   c->pressure,   100,
                    c->pressure >= 50 ? FCYN :
                    c->pressure >= 25 ? FYEL : FRED);
    printf("   ");
    bar("Scrutiny",   c->scrutiny,   100,
        c->scrutiny <= 30 ? FGRN :
        c->scrutiny <= 60 ? FYEL : FRED);
    printf("\n");
    printf(B FYEL
        "====================================================================\n"
        RST);
}

/* ------------------------------------------------------------------ */
/*  Sonar phase                                                        */
/* ------------------------------------------------------------------ */
typedef struct {
    VesselType type;
    int steel;
    int wealth;
    int crew_aboard;
    const char *flag;
} Vessel;

static const char *FLAGS[] = {
    "Norwegian", "Imperial",  "Fae-registered", "Pacific Trade Co.",
    "Goblin Concession", "uncertain",  "Red Lantern Co.",
    "Royal Mail", "free port", "ice-bound colony"
};
#define FLAG_COUNT ((int)(sizeof(FLAGS)/sizeof(FLAGS[0])))

static void roll_vessel(Vessel *v, int turn) {
    /* Weight selection: rare ships more common in later turns. */
    int weights[VES_COUNT] = { 18, 22, 14, 8, 14, 10, 6 };
    if (turn >= 8) { weights[VES_LINER] += 6; weights[VES_TANKER] += 4; }
    if (turn >= 14) { weights[VES_RESEARCH] += 6; weights[VES_PIRATE] += 4; }
    int total = 0;
    for (int i = 0; i < VES_COUNT; i++) total += weights[i];
    int r = rand() % total;
    int t = 0;
    for (int i = 0; i < VES_COUNT; i++) {
        if (r < weights[i]) { t = i; break; }
        r -= weights[i];
    }
    v->type   = (VesselType)t;
    v->steel  = rnd(VES[t].steel_lo,  VES[t].steel_hi);
    v->wealth = rnd(VES[t].wealth_lo, VES[t].wealth_hi);
    v->crew_aboard = VES[t].crew + rnd(-2, 3);
    if (v->crew_aboard < 1) v->crew_aboard = 1;
    v->flag   = FLAGS[rand() % FLAG_COUNT];
}

static void describe_vessel(const Vessel *v) {
    const VesselSpec *s = &VES[v->type];
    int lat = rnd(36, 58), latm = rnd(0, 59);
    int lon = rnd(140, 175), lonm = rnd(0, 59);
    printf("\n  " B FCYN "+----------------- SONAR CONTACT -----------------+" RST "\n");
    printf("    Vessel:  " B "%s" RST "\n", s->name);
    printf("    Flag:    %s\n", v->flag);
    printf("    Bearing: %2dN %02d', %3dW %02d'\n", lat, latm, lon, lonm);
    printf("    Status:  " FRED "DAMAGED" RST ", crew aboard: %d\n", v->crew_aboard);
    printf("    Salvage est: " FYEL "%d steel" RST ", " FYEL "$%d cargo" RST "\n",
           v->steel, v->wealth);
    if (s->special)
        printf("    " FMAG "Note: research vessel detected" RST "\n");
    printf("  " B FCYN "+--------------------------------------------------+" RST "\n");
}

/* ------------------------------------------------------------------ */
/*  Vessel actions                                                     */
/* ------------------------------------------------------------------ */
static void apply_rescue(Game *g, const Vessel *v) {
    const VesselSpec *s = &VES[v->type];
    int saved = v->crew_aboard;
    int casualties = 0;
    /* Pirates rescued = small rep, but crew loyalty boost */
    g->rescued++;
    g->c.population += s->rescue_pop;
    if (v->type == VES_PIRATE) {
        g->c.reputation += 1;
        g->c.morale     += 2;  /* mercy is its own reward */
        printf("  " FGRN "Rescue complete." RST " %d souls hauled aboard.\n", saved);
        printf("  Pirates surrender; population +%d.\n", s->rescue_pop);
    } else {
        g->c.reputation += 4;
        g->c.morale     += 3;
        if (v->type == VES_LINER) {
            g->c.reputation += 4;
            printf("  " FGRN "The papers love you." RST " %d civilian souls saved.\n", saved);
            printf("  Reputation +8, population +%d.\n", s->rescue_pop);
        } else if (v->type == VES_RESEARCH && !g->crew.digory && chance(60)) {
            g->crew.digory = 1;
            printf("  " B FYEL "Among the rescued is a black-and-white terrier" RST "\n");
            printf("  in a small life-vest -- one " B "DIGORY" RST " by name. He bows.\n");
            printf("  " FYEL "Digory has joined your advisors." RST "\n");
            g->c.reputation += 6;
        } else {
            printf("  " FGRN "Rescue complete." RST " %d souls hauled aboard.\n", saved);
            printf("  Reputation +4, population +%d.\n", s->rescue_pop);
        }
    }
    g->c.casualties += casualties;
}

static void apply_salvage(Game *g, const Vessel *v) {
    int casualties = 0;
    int steel = v->steel;
    int wealth = v->wealth;
    /* Bonuses from facilities */
    if (g->d.refineries > 0) steel += g->d.refineries * 2;
    if (g->d.docks > 0)      wealth += g->d.docks * 3;

    g->salvaged++;
    g->c.steel  += steel;
    g->c.wealth += wealth;
    g->c.reputation += (v->type == VES_PIRATE) ? 4 : 2;
    g->c.morale += 1;
    /* Oil tankers risk environmental disaster */
    if (v->type == VES_TANKER) {
        if (chance(g->crew.firebot ? 18 : 45)) {
            casualties = rnd(2, 6);
            g->c.casualties += casualties;
            g->c.reputation -= 8;
            g->c.scrutiny   += 8;
            printf("  " FRED "*** OIL SPILL!" RST " %d casualties; rep -8, scrutiny +8.\n",
                   casualties);
        } else {
            printf("  " FCYN "Tanker contained cleanly." RST " The robots earn their keep.\n");
        }
    }
    /* Research vessel may unlock a tech / character */
    if (v->type == VES_RESEARCH && !g->crew.funny && chance(35)) {
        g->crew.funny = 1;
        printf("  " B FMAG "Among the equipment crates: " RST FMAG "FUNNY" RST B FMAG ", an engineer\n");
        printf("  with too many fuses." RST FMAG " She joins your crew." RST "\n");
    }
    printf("  " FGRN "Salvage complete." RST " +%d steel, +$%d wealth.\n", steel, wealth);
}

static void apply_sabotage(Game *g, const Vessel *v) {
    const VesselSpec *s = &VES[v->type];
    g->sabotaged++;
    g->last_misdirect_turn = g->c.turn;
    /* Sabotage scrutiny is heavy for civilian craft, light for pirates */
    int scrutiny_hit = s->civilian ? (8 + s->sabotage_haz * 2) : 1;
    /* Sabotaging pirates is praised */
    int rep_hit;
    if (v->type == VES_PIRATE) {
        rep_hit = +6;
        printf("  " FGRN "Pirates lured onto the rocks." RST
               " The Admiralty sends a fruitbasket.\n");
        g->c.reputation += rep_hit;
        g->c.steel  += v->steel + 10;
        g->c.wealth += v->wealth + 20;
        printf("  +%d steel, +$%d wealth, reputation +%d.\n",
               v->steel + 10, v->wealth + 20, rep_hit);
        return;
    }
    /* Civilian sabotage */
    rep_hit = -(4 + s->sabotage_haz);
    int extra_steel  = (int)(v->steel  * 1.5) + 10;
    int extra_wealth = (int)(v->wealth * 1.6) + 20;
    int crew_lost    = v->crew_aboard;
    /* Police/Funny mitigate scrutiny */
    if (g->crew.funny)  scrutiny_hit -= 2;
    if (g->d.police)    scrutiny_hit -= g->d.police;
    if (scrutiny_hit < 1) scrutiny_hit = 1;
    g->c.scrutiny  += scrutiny_hit;
    g->c.reputation += rep_hit;
    g->c.morale    -= 4;
    g->c.casualties += crew_lost;
    g->c.steel     += extra_steel;
    g->c.wealth    += extra_wealth;
    printf("  " FRED "Iceberg dispatched. The ship founders %s.\n" RST,
           v->type == VES_TANKER ? "in greasy black plumes" :
           v->type == VES_LINER  ? "to operatic screaming" :
                                   "with a crunch");
    printf("  +%d steel, +$%d wealth, " FRED "%d souls lost" RST ", scrutiny +%d, rep %d.\n",
           extra_steel, extra_wealth, crew_lost, scrutiny_hit, rep_hit);
}

static void resolve_vessel(Game *g, const Vessel *v) {
    const VesselSpec *s = &VES[v->type];
    describe_vessel(v);
    printf("\n  " B "Choose your action:" RST "\n");
    printf("    " FYEL "[1]" RST " Rescue crew, leave the wreck      " D "(rep+, no spoils)" RST "\n");
    printf("    " FYEL "[2]" RST " Rescue & salvage                  " D "(rep+, full spoils)" RST "\n");
    printf("    " FYEL "[3]" RST " Salvage abandoned (no rescue)     " D "(rep-, full spoils, casualties)" RST "\n");
    if (s->civilian) {
        printf("    " FYEL "[4]" RST " " FMAG "Guide onto rocks (sabotage)" RST "    " D "(rep--, BIG spoils, scrutiny+++)" RST "\n");
    } else {
        printf("    " FYEL "[4]" RST " " FGRN "Lure pirates aground (sabotage)" RST " " D "(rep+, big spoils)" RST "\n");
    }
    printf("    " FYEL "[5]" RST " Ignore the contact\n\n");

    int choice = read_choice(1, 5);
    printf("\n");
    switch (choice) {
        case 1: apply_rescue(g, v); break;
        case 2: apply_rescue(g, v); apply_salvage(g, v); break;
        case 3: {
            int lost = v->crew_aboard;
            g->c.casualties += lost;
            g->c.reputation -= 6;
            g->c.scrutiny   += 4;
            g->c.morale     -= 3;
            apply_salvage(g, v);
            printf("  " FRED "%d souls went down with the ship." RST
                   " Reputation -6, scrutiny +4.\n", lost);
            break;
        }
        case 4: apply_sabotage(g, v); break;
        case 5: printf("  " D "You let the contact drift past. The cold hardly notices." RST "\n"); break;
    }
    clamp_city(&g->c);
}

/* ------------------------------------------------------------------ */
/*  Random events                                                      */
/* ------------------------------------------------------------------ */
typedef struct {
    const char *headline;
    void (*apply)(Game *);
} Event;

static void ev_polar_express(Game *g) {
    int s = rnd(20, 40);
    g->c.steel += s;
    printf("  " FCYN "POLAR EXPRESS DELIVERY" RST " -- a freight train hisses out of\n");
    printf("  the steam tube and disgorges crates of plate steel. +%d steel.\n", s);
}

static void ev_santa(Game *g) {
    g->c.reputation = clampi(g->c.reputation + 8, 0, 100);
    printf("  " FRED "DIPLOMATIC VISIT" RST " -- Santa Claus, in waders, tours the city.\n");
    printf("  He says nice things to the press. Reputation +8.\n");
}

static void ev_holymackerel(Game *g) {
    (void)g;
    printf("  " FYEL "\"HOLY MACKEREL!\" FALSE ALARM" RST " -- a panicked sardine triggers\n");
    printf("  the war horn. No effect, just embarrassment.\n");
}

static void ev_squid_strike(Game *g) {
    g->c.morale = clampi(g->c.morale - 8, 0, 100);
    g->c.capacity = (g->c.capacity > 1) ? g->c.capacity - 1 : 1;
    printf("  " FMAG "GIANT SQUID LABOR STRIKE" RST " -- the dock workers form a cooperative.\n");
    printf("  Salvage capacity -1, morale -8.\n");
}

static void ev_iceberg_melt(Game *g) {
    if (g->c.turn - g->last_misdirect_turn <= 3) {
        g->c.scrutiny = clampi(g->c.scrutiny + 12, 0, 100);
        printf("  " FRED "ICEBERG MELTS TOO EARLY" RST " -- the news links the meltwater to your\n");
        printf("  recent \"navigational mishap\". Scrutiny +12.\n");
    } else {
        printf("  " FCYN "ICEBERG MELTS TOO EARLY" RST " -- harmless this time. Scientists shrug.\n");
    }
}

static void ev_pirate_revenge(Game *g) {
    if (g->sabotaged > 0) {
        int loss = rnd(15, 35);
        g->c.steel  = clampi(g->c.steel  - loss, 0, 99999);
        g->c.wealth = clampi(g->c.wealth - loss, 0, 99999);
        printf("  " FRED "PIRATE REVENGE RAID" RST " -- they remember the rocks. -%d steel, -$%d.\n",
               loss, loss);
    } else {
        printf("  " FYEL "PIRATE REVENGE RAID" RST " -- a couple of frigates skulk through and\n");
        printf("  vanish. Your name is not on their list. Yet.\n");
    }
}

static void ev_goblin_dynamite(Game *g) {
    int hit = rnd(8, 18);
    g->c.pressure = clampi(g->c.pressure - hit, 0, 100);
    if (g->crew.firebot) {
        hit /= 2;
        printf("  " FCYN "GOBLIN DYNAMITE ACCIDENT" RST " -- Fireplace Robot smothers the fuse\n");
        printf("  before it spreads. Pressure -%d.\n", hit);
    } else {
        printf("  " FRED "GOBLIN DYNAMITE ACCIDENT" RST " -- a tunnel collapses with a wet boom.\n");
        printf("  Pressure -%d.\n", hit);
    }
}

static void ev_sea_monster(Game *g) {
    (void)g;
    printf("  " FMAG "SEA MONSTER MISUNDERSTANDING" RST " -- a leviathan apologizes\n");
    printf("  profusely for trampling the seafood district. Tea is shared.\n");
}

static void ev_investigator(Game *g) {
    if (g->c.scrutiny >= 50) {
        int rep = rnd(5, 12);
        int gold = rnd(20, 60);
        g->c.reputation = clampi(g->c.reputation - rep, 0, 100);
        g->c.wealth     = clampi(g->c.wealth - gold, 0, 99999);
        printf("  " FRED "INSURANCE INVESTIGATOR ARRIVES" RST " -- a man in a wet trenchcoat\n");
        printf("  asks pointed questions. Bribes paid. -$%d, reputation -%d.\n", gold, rep);
    } else {
        printf("  " FCYN "INSURANCE INVESTIGATOR ARRIVES" RST " -- but finds nothing untoward.\n");
        printf("  He buys a chowder and leaves.\n");
    }
}

static void ev_mitt_arrives(Game *g) {
    if (!g->crew.mitt && g->d.refineries >= 2) {
        g->crew.mitt = 1;
        printf("  " FRED "VISITOR" RST " -- a stout figure in protective leathers descends\n");
        printf("  to the refinery floor. " B "MITT" RST " has arrived; thermal cutters\n");
        printf("  hum to life. Refineries +20%% efficient.\n");
    } else {
        int s = rnd(10, 20);
        g->c.steel += s;
        printf("  " FYEL "FOUNDRY FREIGHTER" RST " -- a passing dwarf-flagged ship sells you\n");
        printf("  scrap on the cheap. +%d steel.\n", s);
    }
}

static void ev_firebot_arrives(Game *g) {
    if (!g->crew.firebot && g->d.apartments >= 2) {
        g->crew.firebot = 1;
        printf("  " FCYN "VISITOR" RST " -- a small bronze automaton with a flame lacquered\n");
        printf("  to its hat applies for facilities work. " B "FIREPLACE ROBOT" RST "\n");
        printf("  joins your staff. Accident risks reduced.\n");
    } else {
        printf("  " FCYN "FIRE DRILL" RST " -- nothing actually burns. Morale +3.\n");
        g->c.morale = clampi(g->c.morale + 3, 0, 100);
    }
}

static const Event EVENTS[] = {
    { "polar express",          ev_polar_express },
    { "santa visit",            ev_santa },
    { "holy mackerel",          ev_holymackerel },
    { "squid strike",           ev_squid_strike },
    { "iceberg melts early",    ev_iceberg_melt },
    { "pirate revenge",         ev_pirate_revenge },
    { "goblin dynamite",        ev_goblin_dynamite },
    { "sea monster",            ev_sea_monster },
    { "insurance investigator", ev_investigator },
    { "mitt visit",             ev_mitt_arrives },
    { "firebot visit",          ev_firebot_arrives },
};
#define EVENT_COUNT ((int)(sizeof(EVENTS)/sizeof(EVENTS[0])))

static void random_event(Game *g) {
    /* Higher chance of investigator if scrutiny high */
    if (g->c.scrutiny >= 60 && chance(50)) {
        printf("\n  " B FYEL "RANDOM EVENT" RST "\n");
        ev_investigator(g);
        clamp_city(&g->c);
        return;
    }
    if (!chance(70)) return;  /* 30%% chance of nothing */
    int idx = rand() % EVENT_COUNT;
    printf("\n  " B FYEL "RANDOM EVENT" RST "\n");
    EVENTS[idx].apply(g);
    clamp_city(&g->c);
}

/* ------------------------------------------------------------------ */
/*  Build phase                                                        */
/* ------------------------------------------------------------------ */
typedef struct {
    char         key;
    const char  *name;
    int          steel_cost;
    int          wealth_cost;
    const char  *blurb;
    int          requires_digory;
    int          unique;          /* max 1 (hotel) */
} Building;

static const Building BLD[] = {
    { 'A', "Container Apartments",  30,  50, "+30 housing capacity",            0, 0 },
    { 'D', "Submarine Docks",       50,  80, "+1 salvage capacity",             0, 0 },
    { 'R', "Salvage Refinery",      60,   0, "+6 steel/turn",                   0, 0 },
    { 'S', "Squid Police HQ",       50, 100, "-3 scrutiny/turn",                0, 0 },
    { 'F', "Seafood District",      40,  70, "+5 wealth/turn, +5 rep one-time", 0, 0 },
    { 'O', "Office Park Hulls",     30,  60, "+5 morale/turn, +10 pop",         0, 0 },
    { 'H', "Digory's Hotel",       150, 250, "+20 rep, +50 pop, requires Digory", 1, 1 },
};
#define BLD_COUNT ((int)(sizeof(BLD)/sizeof(BLD[0])))

static int *district_count_field(Districts *d, char key) {
    switch (key) {
        case 'A': return &d->apartments;
        case 'D': return &d->docks;
        case 'R': return &d->refineries;
        case 'S': return &d->police;
        case 'F': return &d->seafood;
        case 'O': return &d->office;
        case 'H': return &d->hotel;
    }
    return NULL;
}

static void try_build(Game *g, char key) {
    int idx = -1;
    for (int i = 0; i < BLD_COUNT; i++) if (BLD[i].key == key) { idx = i; break; }
    if (idx < 0) {
        printf("  " FRED "Unknown building." RST "\n");
        return;
    }
    const Building *b = &BLD[idx];
    if (b->requires_digory && !g->crew.digory) {
        printf("  " FYEL "Digory has not yet joined you." RST "\n");
        return;
    }
    int *count = district_count_field(&g->d, b->key);
    if (b->unique && *count >= 1) {
        printf("  " FYEL "Already built." RST "\n");
        return;
    }
    if (g->c.steel < b->steel_cost || g->c.wealth < b->wealth_cost) {
        printf("  " FRED "Insufficient resources" RST " (need %d steel, $%d).\n",
               b->steel_cost, b->wealth_cost);
        return;
    }
    g->c.steel  -= b->steel_cost;
    g->c.wealth -= b->wealth_cost;
    (*count)++;
    /* Apply immediate effects */
    switch (key) {
        case 'A': /* +30 housing capacity, no immediate pop */
            printf("  " FGRN "Container apartments stacked into a brass ziggurat." RST "\n");
            break;
        case 'D':
            g->c.capacity += 1;
            printf("  " FGRN "New dock is operational." RST " Capacity now %d/turn.\n",
                   g->c.capacity);
            break;
        case 'R':
            printf("  " FGRN "Refinery furnaces light up." RST " The water glows red.\n");
            break;
        case 'S':
            g->c.scrutiny = clampi(g->c.scrutiny - 5, 0, 100);
            printf("  " FGRN "Squid Police HQ commissioned." RST " Scrutiny -5 immediately.\n");
            break;
        case 'F':
            g->c.reputation = clampi(g->c.reputation + 5, 0, 100);
            printf("  " FGRN "Seafood district opens." RST " The press loves it. Rep +5.\n");
            break;
        case 'O':
            g->c.population += 10;
            printf("  " FGRN "Office hulls open." RST " +10 administrators.\n");
            break;
        case 'H':
            g->c.reputation = clampi(g->c.reputation + 20, 0, 100);
            g->c.population += 50;
            g->sovereign = 1;
            printf("  " B FYEL "DIGORY'S HOTEL" RST " " FGRN "is unveiled." RST "\n");
            printf("  Heads of state RSVP. Rep +20, +50 pop. Sovereignty in sight.\n");
            break;
    }
    clamp_city(&g->c);
}

static void build_phase(Game *g) {
    for (;;) {
        printf("\n  " B FYEL "  CITY PLANNING" RST "  (steel %d, wealth $%d)\n",
               g->c.steel, g->c.wealth);
        printf("  " D "----------------------------------------------------" RST "\n");
        for (int i = 0; i < BLD_COUNT; i++) {
            const Building *b = &BLD[i];
            int *cnt = district_count_field(&g->d, b->key);
            int affordable = (g->c.steel >= b->steel_cost &&
                              g->c.wealth >= b->wealth_cost &&
                              (!b->unique || *cnt == 0) &&
                              (!b->requires_digory || g->crew.digory));
            const char *col = affordable ? FGRN : FGRY;
            printf("    %s[%c]" RST " %-22s %sst %3d  $%3d" RST "  x%d  " D "%s" RST "\n",
                   col, b->key, b->name, col,
                   b->steel_cost, b->wealth_cost,
                   *cnt, b->blurb);
        }
        printf("    " FYEL "[N]" RST " End build phase\n\n");
        printf(B "  > " RST);
        fflush(stdout);
        char buf[64];
        if (!fgets(buf, sizeof(buf), stdin)) exit(0);
        char ch = 0;
        for (int i = 0; buf[i]; i++) if (!isspace((unsigned char)buf[i])) {
            ch = (char)toupper((unsigned char)buf[i]); break;
        }
        if (ch == 'N' || ch == 0) return;
        try_build(g, ch);
    }
}

/* ------------------------------------------------------------------ */
/*  End-of-turn maintenance                                            */
/* ------------------------------------------------------------------ */
static int housing_capacity(const Districts *d) {
    return 20 + d->apartments * 30 + d->office * 10 + d->hotel * 50;
}

static void end_of_turn(Game *g) {
    City *c = &g->c;
    Districts *d = &g->d;

    /* Steel income */
    int steel_income = d->refineries * (g->crew.mitt ? 7 : 6);
    c->steel  += steel_income;

    /* Wealth income */
    int wealth_income = d->seafood * 5 + d->office * 1;
    c->wealth += wealth_income;

    /* Pressure: industrial buildings tax it, offices/seafood/police boost it */
    int regen = 10 + d->office * 2 + d->seafood + d->police;
    int drain = (d->apartments + 1) / 2 + d->refineries * 2 + d->hotel * 2;
    if (g->crew.firebot) drain = (drain * 2) / 3;
    c->pressure += regen - drain;

    /* Morale: police stabilize, office boosts, casualties drag */
    int morale_change = 2 + d->police + d->office;
    if (c->casualties > 0) morale_change -= 1;
    if (g->crew.digory)    morale_change += 1;
    c->morale += morale_change;

    /* Scrutiny: police suppress, time forgets */
    int scrutiny_change = -d->police * 3;
    if (c->scrutiny > 30) scrutiny_change += 1;
    if (g->sabotaged > 0) scrutiny_change += 1;
    c->scrutiny += scrutiny_change;

    /* Population growth: morale & rep & housing room */
    int cap = housing_capacity(d);
    if (c->population < cap && c->reputation >= 50 && c->morale >= 40) {
        int grow = 2 + c->reputation / 20;
        if (g->crew.digory) grow += 2;
        if (c->population + grow > cap) grow = cap - c->population;
        c->population += grow;
    }
    if (c->population > cap) c->population = cap;  /* eviction notice */

    clamp_city(c);
    c->turn++;

    printf("\n  " D "----- end of turn report -----" RST "\n");
    printf("    income:   +%d steel, +$%d wealth\n", steel_income, wealth_income);
    printf("    pressure: %+d (regen %d, drain %d)\n", regen - drain, regen, drain);
    printf("    morale:   %+d   scrutiny: %+d\n", morale_change, scrutiny_change);
    printf("    housing:  %d / %d\n", c->population, cap);
}

/* ------------------------------------------------------------------ */
/*  End conditions                                                     */
/* ------------------------------------------------------------------ */
static int check_end(Game *g) {
    City *c = &g->c;
    if (c->scrutiny >= 100) {
        g->over_reason = "International tribunal seizes the city. The Kraken is jailed.";
        return 1;
    }
    if (c->morale <= 0) {
        g->over_reason = "Crew morale collapses. The squid police mutiny.";
        return 1;
    }
    if (c->pressure <= 0) {
        g->over_reason = "Pressure breach. The metropolis is reclaimed by the deep.";
        return 1;
    }
    if (c->casualties >= 100) {
        g->over_reason = "Civilian casualties pass 100. Naval patrols arrive in force.";
        return 1;
    }
    if (g->sovereign && c->reputation >= WIN_REP && c->population >= WIN_POP) {
        g->over_reason = "VICTORY: Sovereign recognition; the city is now a nation.";
        return 1;
    }
    if (c->turn > MAX_TURNS) {
        if (c->reputation >= WIN_REP && c->population >= WIN_POP)
            g->over_reason = "VICTORY: A thriving city beneath the waves.";
        else
            g->over_reason = "The decade ends; your city endures, but does not yet thrive.";
        return 1;
    }
    return 0;
}

static void final_screen(const Game *g) {
    printf(CLS);
    int win = strncmp(g->over_reason, "VICTORY", 7) == 0;
    if (win) {
        printf("\n" B FGRN
            "       =====================================================\n"
            "                       V I C T O R Y\n"
            "       =====================================================\n"
            RST);
    } else {
        printf("\n" B FRED
            "       =====================================================\n"
            "                       G A M E   O V E R\n"
            "       =====================================================\n"
            RST);
    }
    printf("\n  %s\n\n", g->over_reason);

    printf("  Final ledger\n");
    printf("    Turn reached:        %d / %d\n", g->c.turn - 1, MAX_TURNS);
    printf("    Population:          %d\n", g->c.population);
    printf("    Reputation:          %d%%\n", g->c.reputation);
    printf("    Steel / Wealth:      %d / $%d\n", g->c.steel, g->c.wealth);
    printf("    Pressure / Scrutiny: %d%% / %d%%\n", g->c.pressure, g->c.scrutiny);
    printf("    Lifetime casualties: %d\n", g->c.casualties);
    printf("    Vessels rescued:     %d\n", g->rescued);
    printf("    Vessels salvaged:    %d\n", g->salvaged);
    printf("    Vessels sabotaged:   %d\n", g->sabotaged);

    /* Title based on style of play */
    const char *title = "Salvage Foreman";
    if (win && g->sabotaged == 0)            title = "Saint of the Shoals";
    else if (win && g->sabotaged <= 2)        title = "Lawful Magnate";
    else if (win && g->sabotaged <= 5)        title = "Mostly-Legal Magnate";
    else if (win)                              title = "Kraken Crime Lord";
    else if (g->c.scrutiny >= 100)             title = "Defendant";
    else if (g->c.casualties >= 50)            title = "Industrial Disaster";
    else if (g->c.pressure <= 0)               title = "Posthumous Architect";

    printf("\n  Title earned: " B FYEL "%s" RST "\n\n", title);
}

/* ------------------------------------------------------------------ */
/*  Main game loop                                                     */
/* ------------------------------------------------------------------ */
static void game_loop(Game *g) {
    while (!check_end(g)) {
        status_header(g);
        print_districts(&g->d, &g->crew);
        printf("\n  " B FCYN "SONAR SWEEP -- " RST "scanning North Pacific...\n");

        /* Detect ships up to capacity */
        int detected = 1 + (rand() % g->c.capacity);
        if (g->c.turn < 3 && detected > 2) detected = 2;
        for (int i = 0; i < detected; i++) {
            Vessel v;
            roll_vessel(&v, g->c.turn);
            resolve_vessel(g, &v);
            if (g->c.scrutiny >= 100 || g->c.morale <= 0 || g->c.pressure <= 0) break;
        }

        if (!check_end(g)) {
            random_event(g);
            pause_for_key();
            status_header(g);
            print_districts(&g->d, &g->crew);
            build_phase(g);
            end_of_turn(g);
            pause_for_key();
        }
    }
    final_screen(g);
}

/* ------------------------------------------------------------------ */
/*  Game start                                                         */
/* ------------------------------------------------------------------ */
static void start_game(int diff_idx) {
    Game g;
    memset(&g, 0, sizeof(g));
    const Difficulty *d = &DIFFS[diff_idx];
    g.diff_idx       = diff_idx;
    g.c.steel        = d->starting_steel;
    g.c.wealth       = d->starting_wealth;
    g.c.reputation   = d->starting_rep;
    g.c.morale       = 70;
    g.c.pressure     = 80;
    g.c.scrutiny     = d->starting_scrutiny;
    g.c.population   = d->starting_pop;
    g.c.turn         = 1;
    g.c.capacity     = 1;
    g.last_misdirect_turn = -10;

    /* Intro flavor */
    printf(CLS);
    printf(B FCYN "  PROLOGUE\n" RST);
    printf("  ----------------------------------------------------------\n\n");
    printf("  The North Pacific is wide, dark, and full of shipping. You\n");
    printf("  are the Kraken: ancient, weary, civic-minded. Beneath the\n");
    printf("  cold a thousand brass lanterns blink awake. The sonar room\n");
    printf("  rings with the pings of distant hulls in distress.\n\n");
    printf("  " FYEL "Rescue first. Salvage second. Build a city beneath the waves." RST "\n\n");
    pause_for_key();

    game_loop(&g);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
int main(void) {
    /* Line-buffered stdout works fine for this game; ensure output flushes. */
    setvbuf(stdout, NULL, _IOLBF, 0);
    srand((unsigned)time(NULL) ^ (unsigned)(uintptr_t)&main);

    for (;;) {
        title_screen();
        int c = read_choice(1, 3);
        if (c == 1) {
            int diff = select_difficulty();
            start_game(diff);
            pause_for_key();
        } else if (c == 2) {
            about_screen();
        } else {
            printf(CLS FCYN "  ~~~ The Kraken returns to the deep. ~~~" RST "\n\n");
            return 0;
        }
    }
}
