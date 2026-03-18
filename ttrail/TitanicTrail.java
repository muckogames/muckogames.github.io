import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import java.util.*;
import java.util.List;

/**
 * TITANIC TRAIL
 * A voyage simulation game inspired by Oregon Trail.
 * Board the RMS Titanic for her maiden voyage, April 1912.
 */
public class TitanicTrail {

    static GameState gs;
    static JFrame    frame;
    static JPanel    root;

    // ── Palette ──────────────────────────────────────────────────────────────
    static final Color C_SKY    = new Color(  5,   5,  30);
    static final Color C_OCEAN  = new Color(  5,  25,  65);
    static final Color C_OCEAN2 = new Color( 10,  55, 120);
    static final Color C_PANEL  = new Color( 18,  38,  78);
    static final Color C_PANEL2 = new Color( 25,  50,  95);
    static final Color C_GOLD   = new Color(212, 175,  55);
    static final Color C_CREAM  = new Color(255, 248, 215);
    static final Color C_RED    = new Color(190,  40,  40);
    static final Color C_GREEN  = new Color( 40, 160,  70);
    static final Color C_TEXT   = new Color(220, 210, 180);
    static final Color C_DIM    = new Color(140, 130, 110);

    // ── Entry point ──────────────────────────────────────────────────────────
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            frame = new JFrame("Titanic Trail");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setSize(820, 620);
            frame.setResizable(false);
            frame.setLocationRelativeTo(null);
            root = new JPanel(new BorderLayout());
            frame.setContentPane(root);
            frame.setVisible(true);
            goTo(new TitlePanel());
        });
    }

    static void goTo(JPanel p) {
        root.removeAll();
        root.add(p, BorderLayout.CENTER);
        root.revalidate();
        root.repaint();
        p.requestFocusInWindow();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAME STATE
    // ─────────────────────────────────────────────────────────────────────────
    static class GameState {
        String[] names  = {"", "", "", "", ""};
        int[]    health = {100, 100, 100, 100, 100};
        boolean[] alive = {true, true, true, true, true};
        int shipClass   = 2;

        int food;       // pounds
        int coal;       // tons (ship burns this)
        int medicine;   // doses
        int money;      // shillings
        int lifeboats;  // seats available

        int progress = 0;   // 0–100
        int dayNum   = 0;   // elapsed days from April 10
        int speed    = 2;   // 1=slow, 2=moderate, 3=full
        int rations  = 2;   // 1=meager, 2=normal, 3=filling

        boolean visitedCherbourg  = false;
        boolean visitedQueenstown = false;
        boolean receivedIceWarning = false;
        boolean slowedForIce       = false;
        int icebergHits            = 0;
        boolean sank               = false;
        int lastFishDay            = -10; // day last fished (cooldown)

        List<String> log = new ArrayList<>();

        // Progress thresholds
        static final int T_CHERBOURG  =  8;
        static final int T_QUEENSTOWN = 16;
        static final int T_ICEBERG    = 88;

        void init() {
            switch (shipClass) {
                case 1: food=400; coal=700; medicine=8; money=400; lifeboats=8; break;
                case 2: food=260; coal=600; medicine=5; money=150; lifeboats=5; break;
                default:food=150; coal=500; medicine=2; money= 60; lifeboats=3; break;
            }
            log.add("April 10, 1912 — Southampton, England");
            log.add("The RMS Titanic departs on her maiden voyage to New York City.");
            log.add("She is the largest ship ever built. Good luck.");
        }

        void addLog(String s) { log.add(s); }

        int aliveCount() {
            int n = 0; for (boolean a : alive) if (a) n++; return n;
        }
        int avgHealth() {
            int s=0,n=0; for(int i=0;i<5;i++) if(alive[i]){s+=health[i];n++;} return n>0?s/n:0;
        }
        String dateStr() {
            String[] months = {"Jan","Feb","Mar","Apr","May"};
            int d = 10 + dayNum;
            return "April " + d + ", 1912";
        }
        String locationName() {
            if (progress <  T_CHERBOURG)  return "English Channel";
            if (progress <  T_QUEENSTOWN) return "Near Cherbourg, France";
            if (progress <  30)           return "Near Queenstown, Ireland";
            if (progress <  60)           return "North Atlantic";
            if (progress <  T_ICEBERG)    return "Grand Banks — Iceberg Alley Ahead";
            return "Iceberg Alley";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: styled button
    // ─────────────────────────────────────────────────────────────────────────
    static JButton styledBtn(String text, Color bg) {
        JButton b = new JButton(text);
        b.setBackground(bg);
        b.setForeground(C_CREAM);
        b.setFont(new Font("Serif", Font.BOLD, 14));
        b.setFocusPainted(false);
        b.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(C_GOLD, 1),
            BorderFactory.createEmptyBorder(5, 14, 5, 14)));
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        b.addMouseListener(new MouseAdapter() {
            Color orig = bg;
            public void mouseEntered(MouseEvent e) { b.setBackground(bg.brighter()); }
            public void mouseExited(MouseEvent e)  { b.setBackground(orig); }
        });
        return b;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TITLE PANEL
    // ─────────────────────────────────────────────────────────────────────────
    static class TitlePanel extends JPanel {
        private float blink = 0f;
        private javax.swing.Timer blinkTimer;

        TitlePanel() {
            setBackground(C_SKY);
            setLayout(new BorderLayout());
            blinkTimer = new javax.swing.Timer(60, e -> { blink += 0.08f; repaint(); });
            blinkTimer.start();
            addMouseListener(new MouseAdapter() {
                public void mouseClicked(MouseEvent e) {
                    blinkTimer.stop();
                    goTo(new SetupPanel());
                }
            });
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2 = (Graphics2D) g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int w = getWidth(), h = getHeight();

            // Sky
            GradientPaint sky = new GradientPaint(0,0,C_SKY,0,h*2/3,C_OCEAN);
            g2.setPaint(sky); g2.fillRect(0,0,w,h*2/3);
            // Ocean
            GradientPaint sea = new GradientPaint(0,h*2/3,C_OCEAN,0,h,C_OCEAN2);
            g2.setPaint(sea); g2.fillRect(0,h*2/3,w,h/3);

            // Stars
            Random rng = new Random(777);
            for (int i=0; i<120; i++) {
                int sx=rng.nextInt(w), sy=rng.nextInt(h*2/3-40);
                float tw = (float)(0.4+0.6*Math.abs(Math.sin(blink+i*0.3)));
                g2.setColor(new Color(1f,1f,1f,tw));
                g2.fillOval(sx,sy,rng.nextInt(2)+1,rng.nextInt(2)+1);
            }
            // Moon
            g2.setColor(new Color(255,250,200,200));
            g2.fillOval(w-120,30,60,60);
            g2.setColor(C_SKY);
            g2.fillOval(w-107,26,60,60);

            // Titanic silhouette
            int sy = h*2/3 - 5;
            drawShip(g2, w/2, sy, 500);

            // Water shimmer
            g2.setColor(new Color(30,80,160,80));
            g2.fillRect(0, sy+22, w, 12);
            g2.setColor(new Color(10,50,120,60));
            g2.fillRect(0, sy+34, w, 8);

            // Title
            g2.setFont(new Font("Serif", Font.BOLD, 68));
            FontMetrics fm = g2.getFontMetrics();
            // Shadow
            g2.setColor(new Color(0,0,0,120));
            g2.drawString("TITANIC TRAIL", (w-fm.stringWidth("TITANIC TRAIL"))/2+3, 108);
            // Gold
            g2.setColor(C_GOLD);
            g2.drawString("TITANIC TRAIL", (w-fm.stringWidth("TITANIC TRAIL"))/2, 105);

            g2.setFont(new Font("Serif", Font.ITALIC, 19));
            fm = g2.getFontMetrics();
            String sub = "A Maiden Voyage — April 1912";
            g2.setColor(C_CREAM);
            g2.drawString(sub, (w-fm.stringWidth(sub))/2, 138);

            // Subtitle line
            g2.setColor(C_GOLD);
            g2.setStroke(new BasicStroke(1f));
            g2.drawLine((w-380)/2, 148, (w+380)/2, 148);

            // Blinking prompt
            float alpha = (float)(0.5+0.5*Math.sin(blink*1.5));
            g2.setFont(new Font("Serif", Font.PLAIN, 16));
            fm = g2.getFontMetrics();
            String press = "Click anywhere to begin your voyage";
            g2.setColor(new Color(220,210,180,(int)(alpha*220)));
            g2.drawString(press, (w-fm.stringWidth(press))/2, h-28);

            // Credit
            g2.setFont(new Font("SansSerif", Font.PLAIN, 11));
            fm = g2.getFontMetrics();
            String credit = "In memory of the 1,517 souls lost on April 15, 1912";
            g2.setColor(new Color(160,150,130,160));
            g2.drawString(credit, (w-fm.stringWidth(credit))/2, h-8);
        }

        static void drawShip(Graphics2D g2, int cx, int baseY, int len) {
            Color hull = new Color(15,15,35);
            Color super_ = new Color(200,195,180);
            // Hull
            int[] hx = {cx-len/2, cx-len/2+15, cx+len/2-30, cx+len/2+5, cx+len/2-5, cx-len/2+5};
            int[] hy = {baseY+8, baseY+18, baseY+18, baseY+5, baseY-3, baseY-3};
            g2.setColor(hull); g2.fillPolygon(hx, hy, 6);
            // White stripe
            g2.setColor(new Color(220,210,190));
            g2.setStroke(new BasicStroke(2));
            g2.drawLine(cx-len/2+18, baseY+4, cx+len/2-5, baseY+4);
            // Superstructure
            g2.setColor(super_);
            g2.fillRect(cx-len/4-20, baseY-28, len/2+20, 25);
            // Funnels (4)
            Color[] funColors = {new Color(180,60,20),new Color(180,60,20),new Color(180,60,20),new Color(80,80,80)};
            int[] fPos = {cx-90,cx-40,cx+10,cx+60};
            for (int i=0;i<4;i++) {
                g2.setColor(hull);
                g2.fillRect(fPos[i]-8, baseY-58, 16, 32);
                g2.setColor(funColors[i]);
                g2.fillRect(fPos[i]-7, baseY-60, 14, 8);
                // Smoke
                g2.setColor(new Color(80,80,90,80));
                g2.fillOval(fPos[i]-6, baseY-75, 12, 20);
            }
            // Forward mast
            g2.setColor(hull); g2.setStroke(new BasicStroke(3));
            g2.drawLine(cx-len/2+40, baseY-3, cx-len/2+40, baseY-75);
            // Rear mast
            g2.drawLine(cx+30, baseY-28, cx+30, baseY-75);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP PANEL
    // ─────────────────────────────────────────────────────────────────────────
    static class SetupPanel extends JPanel {
        JTextField[] nameFields = new JTextField[5];
        int selectedClass = 2;
        JPanel classPanel;

        SetupPanel() {
            setBackground(C_OCEAN);
            setLayout(new BorderLayout(10,10));
            setBorder(BorderFactory.createEmptyBorder(20,30,20,30));

            // Title
            JLabel title = new JLabel("Passenger Manifest — RMS Titanic", SwingConstants.CENTER);
            title.setFont(new Font("Serif", Font.BOLD, 26));
            title.setForeground(C_GOLD);
            title.setBorder(BorderFactory.createEmptyBorder(0,0,10,0));
            add(title, BorderLayout.NORTH);

            // Center
            JPanel center = new JPanel(new GridLayout(1,2,20,0));
            center.setOpaque(false);

            // Left: class selection
            JPanel leftPanel = new JPanel();
            leftPanel.setLayout(new BoxLayout(leftPanel, BoxLayout.Y_AXIS));
            leftPanel.setOpaque(false);

            JLabel classLabel = new JLabel("Choose Your Class:");
            classLabel.setFont(new Font("Serif", Font.BOLD, 17));
            classLabel.setForeground(C_GOLD);
            classLabel.setAlignmentX(LEFT_ALIGNMENT);
            leftPanel.add(classLabel);
            leftPanel.add(Box.createVerticalStrut(10));

            String[][] classInfo = {
                {"First Class","Luxury cabins on upper decks.",
                 "Resources: Plentiful food, coal & medicine.",
                 "Lifeboat access: Excellent (6 seats)",
                 "Cost: £870 per berth"},
                {"Second Class","Comfortable mid-ship cabins.",
                 "Resources: Adequate for the voyage.",
                 "Lifeboat access: Good (5 seats)",
                 "Cost: £12 per berth"},
                {"Third Class (Steerage)","Below-deck shared quarters.",
                 "Resources: Limited — manage carefully!",
                 "Lifeboat access: Limited (3 seats)",
                 "Cost: £3 per berth"}
            };

            classPanel = new JPanel(new GridLayout(3,1,5,8));
            classPanel.setOpaque(false);
            ButtonGroup bg = new ButtonGroup();
            for (int i=0; i<3; i++) {
                final int cls = i+1;
                JPanel cp = createClassCard(cls, classInfo[i], cls==2);
                bg.add((JRadioButton)((JPanel)((JPanel)cp).getComponent(0)).getComponent(0));
                cp.addMouseListener(new MouseAdapter(){
                    public void mouseClicked(MouseEvent e){ selectClass(cls); }
                });
                classPanel.add(cp);
            }
            leftPanel.add(classPanel);
            center.add(leftPanel);

            // Right: passenger names
            JPanel rightPanel = new JPanel();
            rightPanel.setLayout(new BoxLayout(rightPanel, BoxLayout.Y_AXIS));
            rightPanel.setOpaque(false);

            JLabel nameLabel = new JLabel("Enter Passenger Names:");
            nameLabel.setFont(new Font("Serif", Font.BOLD, 17));
            nameLabel.setForeground(C_GOLD);
            nameLabel.setAlignmentX(LEFT_ALIGNMENT);
            rightPanel.add(nameLabel);
            rightPanel.add(Box.createVerticalStrut(6));

            JLabel hint = new JLabel("(5 passengers — first is the leader)");
            hint.setFont(new Font("Serif", Font.ITALIC, 13));
            hint.setForeground(C_DIM);
            hint.setAlignmentX(LEFT_ALIGNMENT);
            rightPanel.add(hint);
            rightPanel.add(Box.createVerticalStrut(12));

            String[] defaults = {"John","Mary","Thomas","Alice","Robert"};
            for (int i=0; i<5; i++) {
                JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT,5,2));
                row.setOpaque(false);
                JLabel lbl = new JLabel((i==0?"Leader: ":"Person "+(i+1)+": "));
                lbl.setFont(new Font("Serif", Font.PLAIN, 14));
                lbl.setForeground(i==0?C_GOLD:C_TEXT);
                lbl.setPreferredSize(new Dimension(80,22));
                JTextField tf = new JTextField(defaults[i], 14);
                tf.setFont(new Font("Serif", Font.PLAIN, 14));
                tf.setBackground(C_PANEL2);
                tf.setForeground(C_CREAM);
                tf.setCaretColor(C_CREAM);
                tf.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(C_GOLD,1),
                    BorderFactory.createEmptyBorder(2,5,2,5)));
                nameFields[i] = tf;
                row.add(lbl); row.add(tf);
                rightPanel.add(row);
                rightPanel.add(Box.createVerticalStrut(4));
            }

            JLabel note = new JLabel("<html><i>Historical note: The Titanic carried<br>"
                + "2,224 passengers and crew on her only voyage.</i></html>");
            note.setFont(new Font("Serif", Font.ITALIC, 12));
            note.setForeground(C_DIM);
            rightPanel.add(Box.createVerticalStrut(10));
            rightPanel.add(note);

            center.add(rightPanel);
            add(center, BorderLayout.CENTER);

            // Bottom button
            JPanel bottom = new JPanel(new FlowLayout(FlowLayout.CENTER));
            bottom.setOpaque(false);
            JButton startBtn = styledBtn("  Board the Titanic  ", new Color(60,100,40));
            startBtn.setFont(new Font("Serif", Font.BOLD, 17));
            startBtn.addActionListener(e -> startGame());
            bottom.add(startBtn);
            add(bottom, BorderLayout.SOUTH);
        }

        JPanel createClassCard(int cls, String[] info, boolean selected) {
            JPanel card = new JPanel(new BorderLayout(5,0));
            card.setBackground(selected ? C_PANEL2 : C_PANEL);
            card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(selected?C_GOLD:new Color(60,80,120),1),
                BorderFactory.createEmptyBorder(6,8,6,8)));
            card.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));

            JPanel top = new JPanel(new FlowLayout(FlowLayout.LEFT,5,0));
            top.setOpaque(false);
            JRadioButton rb = new JRadioButton();
            rb.setSelected(selected);
            rb.setOpaque(false);
            rb.setFocusPainted(false);
            JLabel name = new JLabel(info[0]);
            name.setFont(new Font("Serif", Font.BOLD, 15));
            name.setForeground(cls==1?C_GOLD:cls==2?C_CREAM:C_DIM);
            top.add(rb); top.add(name);
            card.add(top, BorderLayout.NORTH);

            StringBuilder sb = new StringBuilder("<html><font color='#c8c0a0' size='3'>");
            for (int i=1;i<info.length;i++) sb.append(info[i]).append("<br>");
            sb.append("</font></html>");
            JLabel detail = new JLabel(sb.toString());
            detail.setBorder(BorderFactory.createEmptyBorder(2,22,0,0));
            card.add(detail, BorderLayout.CENTER);
            return card;
        }

        void selectClass(int cls) {
            selectedClass = cls;
            Component[] cards = classPanel.getComponents();
            for (int i=0;i<3;i++) {
                JPanel c = (JPanel) cards[i];
                boolean sel = (i+1==cls);
                c.setBackground(sel?C_PANEL2:C_PANEL);
                c.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(sel?C_GOLD:new Color(60,80,120),1),
                    BorderFactory.createEmptyBorder(6,8,6,8)));
                JPanel top = (JPanel) c.getComponent(0);
                ((JRadioButton)top.getComponent(0)).setSelected(sel);
            }
        }

        void startGame() {
            gs = new GameState();
            gs.shipClass = selectedClass;
            for (int i=0;i<5;i++) {
                String n = nameFields[i].getText().trim();
                gs.names[i] = n.isEmpty() ? "Passenger "+(i+1) : n;
            }
            gs.init();
            goTo(new VoyagePanel());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VOYAGE PANEL
    // ─────────────────────────────────────────────────────────────────────────
    static class VoyagePanel extends JPanel {
        JTextArea logArea;
        JLabel dateLabel, locationLabel;
        JLabel foodLbl, coalLbl, medLbl, moneyLbl, lifeBoatLbl;
        JPanel passengerPanel;
        JButton continueBtn, restBtn, statusBtn, speedBtn, rationsBtn, fishBtn;
        JLabel speedLbl, rationsLbl;

        static final Random RNG = new Random();

        // Waypoint stops
        boolean pendingStore   = false;
        String  pendingPortName = "";

        VoyagePanel() {
            setBackground(C_OCEAN);
            setLayout(new BorderLayout(5,5));
            setBorder(BorderFactory.createEmptyBorder(8,10,8,10));
            buildUI();
            refreshLog();
            refreshStatus();
        }

        void buildUI() {
            // ── Top: map ──────────────────────────────────────────────────
            MapStrip map = new MapStrip();
            map.setPreferredSize(new Dimension(800, 80));
            add(map, BorderLayout.NORTH);

            // ── Left: log ────────────────────────────────────────────────
            logArea = new JTextArea();
            logArea.setEditable(false);
            logArea.setLineWrap(true);
            logArea.setWrapStyleWord(true);
            logArea.setFont(new Font("Serif", Font.PLAIN, 14));
            logArea.setBackground(new Color(8,20,50));
            logArea.setForeground(C_TEXT);
            logArea.setBorder(BorderFactory.createEmptyBorder(8,10,8,10));
            JScrollPane scroll = new JScrollPane(logArea);
            scroll.setBorder(BorderFactory.createLineBorder(C_GOLD,1));
            scroll.setBackground(C_OCEAN);
            scroll.getVerticalScrollBar().setUnitIncrement(16);

            // ── Right: status panel ───────────────────────────────────────
            JPanel statusPanel = new JPanel();
            statusPanel.setLayout(new BoxLayout(statusPanel, BoxLayout.Y_AXIS));
            statusPanel.setBackground(C_PANEL);
            statusPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(C_GOLD,1),
                BorderFactory.createEmptyBorder(8,10,8,10)));
            statusPanel.setPreferredSize(new Dimension(200,400));

            dateLabel     = statusLbl("April 10, 1912", C_GOLD, Font.BOLD, 13);
            locationLabel = statusLbl("English Channel", C_CREAM, Font.ITALIC, 12);
            statusPanel.add(dateLabel);
            statusPanel.add(Box.createVerticalStrut(2));
            statusPanel.add(locationLabel);
            statusPanel.add(Box.createVerticalStrut(8));
            statusPanel.add(sepLabel("— RESOURCES —"));
            statusPanel.add(Box.createVerticalStrut(4));
            foodLbl     = statusLbl("", C_TEXT, Font.PLAIN, 13);
            coalLbl     = statusLbl("", C_TEXT, Font.PLAIN, 13);
            medLbl      = statusLbl("", C_TEXT, Font.PLAIN, 13);
            moneyLbl    = statusLbl("", C_TEXT, Font.PLAIN, 13);
            lifeBoatLbl = statusLbl("", new Color(180,60,60), Font.BOLD, 13);
            statusPanel.add(foodLbl);
            statusPanel.add(coalLbl);
            statusPanel.add(medLbl);
            statusPanel.add(moneyLbl);
            statusPanel.add(Box.createVerticalStrut(4));
            statusPanel.add(lifeBoatLbl);
            statusPanel.add(Box.createVerticalStrut(10));
            statusPanel.add(sepLabel("— PASSENGERS —"));
            statusPanel.add(Box.createVerticalStrut(4));
            passengerPanel = new JPanel();
            passengerPanel.setLayout(new BoxLayout(passengerPanel, BoxLayout.Y_AXIS));
            passengerPanel.setOpaque(false);
            statusPanel.add(passengerPanel);
            statusPanel.add(Box.createVerticalGlue());
            statusPanel.add(sepLabel("— SETTINGS —"));
            statusPanel.add(Box.createVerticalStrut(4));
            speedLbl   = statusLbl("", C_TEXT, Font.PLAIN, 12);
            rationsLbl = statusLbl("", C_TEXT, Font.PLAIN, 12);
            statusPanel.add(speedLbl);
            statusPanel.add(rationsLbl);

            // Center
            JPanel center = new JPanel(new BorderLayout(5,0));
            center.setOpaque(false);
            center.add(scroll, BorderLayout.CENTER);
            center.add(statusPanel, BorderLayout.EAST);
            add(center, BorderLayout.CENTER);

            // ── Bottom: buttons ───────────────────────────────────────────
            JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 8, 4));
            btnRow.setOpaque(false);
            continueBtn = styledBtn("Continue Voyage", C_PANEL2);
            restBtn     = styledBtn("Rest for the Day", new Color(50,80,50));
            speedBtn    = styledBtn("Change Speed", new Color(70,50,20));
            rationsBtn  = styledBtn("Change Rations", new Color(20,60,60));
            statusBtn   = styledBtn("Full Status", C_PANEL);
            fishBtn     = styledBtn("Go Fishing", new Color(0,90,90));

            continueBtn.addActionListener(e -> doAdvance(false));
            restBtn.addActionListener(e -> doRest());
            speedBtn.addActionListener(e -> doSpeed());
            rationsBtn.addActionListener(e -> doRations());
            statusBtn.addActionListener(e -> showFullStatus());
            fishBtn.addActionListener(e -> doFishing());

            btnRow.add(continueBtn); btnRow.add(restBtn);
            btnRow.add(speedBtn); btnRow.add(rationsBtn);
            btnRow.add(statusBtn); btnRow.add(fishBtn);
            add(btnRow, BorderLayout.SOUTH);
        }

        JLabel statusLbl(String text, Color color, int style, int size) {
            JLabel l = new JLabel(text);
            l.setFont(new Font("Serif", style, size));
            l.setForeground(color);
            l.setAlignmentX(LEFT_ALIGNMENT);
            return l;
        }

        JLabel sepLabel(String text) {
            JLabel l = new JLabel(text, SwingConstants.CENTER);
            l.setFont(new Font("SansSerif", Font.BOLD, 10));
            l.setForeground(C_DIM);
            l.setAlignmentX(CENTER_ALIGNMENT);
            l.setMaximumSize(new Dimension(200,16));
            return l;
        }

        void refreshLog() {
            StringBuilder sb = new StringBuilder();
            int start = Math.max(0, gs.log.size()-30);
            for (int i=start;i<gs.log.size();i++) sb.append(gs.log.get(i)).append("\n");
            logArea.setText(sb.toString());
            logArea.setCaretPosition(logArea.getDocument().getLength());
        }

        void refreshStatus() {
            dateLabel.setText(gs.dateStr());
            locationLabel.setText(gs.locationName());
            foodLbl.setText("Food:     " + gs.food + " lbs");
            coalLbl.setText("Coal:     " + gs.coal + " tons");
            medLbl.setText("Medicine: " + gs.medicine + " doses");
            moneyLbl.setText("Money:    " + gs.money + " shillings");
            lifeBoatLbl.setText("Lifeboats:" + gs.lifeboats + " seats");
            foodLbl.setForeground(gs.food<50?C_RED:C_TEXT);
            coalLbl.setForeground(gs.coal<80?C_RED:C_TEXT);

            passengerPanel.removeAll();
            for (int i=0;i<5;i++) {
                String name = gs.names[i].length()>10?gs.names[i].substring(0,10):gs.names[i];
                String hstr;
                Color hcol;
                if (!gs.alive[i]) { hstr="✝ deceased"; hcol=C_DIM; }
                else if (gs.health[i]>=80) { hstr=gs.health[i]+"%"; hcol=C_GREEN; }
                else if (gs.health[i]>=40) { hstr=gs.health[i]+"%"; hcol=C_GOLD; }
                else                       { hstr=gs.health[i]+"%"; hcol=C_RED; }
                JLabel lbl = new JLabel(name+": "+hstr);
                lbl.setFont(new Font("SansSerif", Font.PLAIN, 11));
                lbl.setForeground(hcol);
                lbl.setAlignmentX(LEFT_ALIGNMENT);
                passengerPanel.add(lbl);
            }

            String[] speeds = {"Slow (1/2 speed)","Moderate","Full Steam Ahead!"};
            String[] rats   = {"Meager Rations","Normal Rations","Filling Rations"};
            speedLbl.setText("Speed: "+speeds[gs.speed-1]);
            rationsLbl.setText("Rations: "+rats[gs.rations-1]);

            passengerPanel.revalidate();
            passengerPanel.repaint();

            // Update fishing button availability
            boolean canFish = gs.progress >= GameState.T_QUEENSTOWN
                           && gs.progress < 80
                           && gs.dayNum - gs.lastFishDay >= 3;
            if (fishBtn != null) fishBtn.setEnabled(canFish);

            // Update map
            Component north = ((BorderLayout)getLayout()).getLayoutComponent(BorderLayout.NORTH);
            if (north != null) north.repaint();
        }

        // ── Advance voyage ────────────────────────────────────────────────
        void doAdvance(boolean resting) {
            if (gs.aliveCount() == 0) { goTo(new EndingPanel()); return; }
            if (gs.progress >= GameState.T_ICEBERG) {
                goTo(new IcebergPanel()); return;
            }

            // Consume resources
            int foodNeeded = (gs.rations) * 6;
            int coalNeeded = gs.speed * 25;
            gs.food -= foodNeeded;
            gs.coal -= coalNeeded;
            if (gs.food < 0) gs.food = 0;
            if (gs.coal < 0) gs.coal = 0;

            // Check starvation
            if (gs.food == 0) {
                gs.addLog("!! No food remaining! Passengers grow weak!");
                for (int i=0;i<5;i++) if (gs.alive[i]) gs.health[i] = Math.max(0, gs.health[i]-8);
            }
            // Check coal
            if (gs.coal == 0) {
                gs.addLog("!! The boilers have gone cold! The ship drifts.");
            }

            // Progress
            int prog = gs.coal > 0 ? gs.speed * 4 : 1;
            if (gs.slowedForIce) prog = Math.max(1, prog - 2);
            gs.progress = Math.min(100, gs.progress + prog);
            gs.dayNum++;

            // Health decay / recovery
            for (int i=0;i<5;i++) {
                if (!gs.alive[i]) continue;
                if (resting) {
                    gs.health[i] = Math.min(100, gs.health[i]+12);
                } else if (gs.rations==1) {
                    gs.health[i] = Math.max(0, gs.health[i]-3);
                } else if (gs.rations==3) {
                    gs.health[i] = Math.min(100, gs.health[i]+2);
                }
                if (gs.health[i] == 0 && gs.alive[i]) {
                    gs.alive[i] = false;
                    gs.addLog("!! "+gs.names[i]+" has died!");
                }
            }

            // Log progress
            gs.addLog(gs.dateStr()+" — Day "+gs.dayNum+". Progress: "+gs.progress+"% — "+gs.locationName());

            // Check waypoints
            if (!gs.visitedCherbourg && gs.progress >= GameState.T_CHERBOURG) {
                gs.visitedCherbourg = true;
                pendingStore = true;
                pendingPortName = "Cherbourg, France";
                gs.addLog("Approaching Cherbourg, France. The ship slows to take on passengers.");
            } else if (!gs.visitedQueenstown && gs.progress >= GameState.T_QUEENSTOWN) {
                gs.visitedQueenstown = true;
                pendingStore = true;
                pendingPortName = "Queenstown, Ireland";
                gs.addLog("Approaching Queenstown, Ireland — the last port before the open Atlantic.");
            } else if (!gs.receivedIceWarning && gs.progress >= 60) {
                gs.receivedIceWarning = true;
                showIceWarning();
            } else {
                // Random event
                if (RNG.nextInt(100) < 35) fireRandomEvent();
            }

            // Check for iceberg alley
            if (gs.progress >= GameState.T_ICEBERG) {
                gs.addLog("=== April 14, 1912 — 11:40 PM ===");
                gs.addLog("LOOKOUT FREDERICK FLEET RINGS THE BELL:");
                gs.addLog("\"ICEBERG, RIGHT AHEAD!\"");
                gs.addLog("The officer on duty orders: Hard to Starboard!");
            }

            refreshLog();
            refreshStatus();

            if (pendingStore) {
                pendingStore = false;
                goTo(new StorePanel(pendingPortName));
                return;
            }

            if (gs.progress >= GameState.T_ICEBERG) {
                JOptionPane.showMessageDialog(frame,
                    "The night of April 14th has come.\n" +
                    "Icebergs have been spotted dead ahead!\n\n" +
                    "You must navigate through Iceberg Alley.\n" +
                    "Use LEFT and RIGHT arrow keys to steer.\n" +
                    "Avoid the icebergs — or face the consequences!\n\n" +
                    "("+gs.aliveCount()+" passengers, "+gs.lifeboats+" lifeboat seats)",
                    "ICEBERG AHEAD!", JOptionPane.WARNING_MESSAGE);
                goTo(new IcebergPanel());
            }
        }

        void doRest() {
            gs.addLog("The ship rests at reduced speed. Passengers recover.");
            doAdvance(true);
        }

        void doFishing() {
            gs.addLog("» The engines slow. Fishing lines are cast off the stern deck.");
            goTo(new FishingPanel());
        }

        void doSpeed() {
            String[] opts = {"Slow (conserve coal, safer)","Moderate","Full Steam Ahead (risky)"};
            int cur = gs.speed-1;
            String choice = (String)JOptionPane.showInputDialog(frame,
                "Select engine speed:", "Change Speed",
                JOptionPane.PLAIN_MESSAGE, null, opts, opts[cur]);
            if (choice!=null) {
                gs.speed = Arrays.asList(opts).indexOf(choice)+1;
                gs.addLog("Speed changed to: "+choice);
                refreshLog(); refreshStatus();
            }
        }

        void doRations() {
            String[] opts = {"Meager (save food, lose health)","Normal","Filling (use more food)"};
            int cur = gs.rations-1;
            String choice = (String)JOptionPane.showInputDialog(frame,
                "Set daily rations:", "Change Rations",
                JOptionPane.PLAIN_MESSAGE, null, opts, opts[cur]);
            if (choice!=null) {
                gs.rations = Arrays.asList(opts).indexOf(choice)+1;
                gs.addLog("Rations changed to: "+choice);
                refreshLog(); refreshStatus();
            }
        }

        void showIceWarning() {
            gs.addLog("— Wireless operator Harold Bride receives urgent messages —");
            gs.addLog("MULTIPLE SHIPS REPORT LARGE ICEBERGS AND ICE FIELD AHEAD.");
            gs.addLog("The SS Californian, SS Baltic, and SS Mesaba all report ice.");

            int result = JOptionPane.showOptionDialog(frame,
                "WIRELESS WARNING:\n\n" +
                "Multiple ships report icebergs and\n" +
                "ice fields along our planned route.\n\n" +
                "What do you order?",
                "Ice Warning Received",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.WARNING_MESSAGE, null,
                new String[]{"Slow Down (safer approach)",
                             "Maintain Speed (arrive on schedule)"},
                "Slow Down (safer approach)");

            if (result == 0) {
                gs.slowedForIce = true;
                gs.addLog("Captain orders reduced speed through the ice field.");
                gs.addLog("The voyage will arrive slightly behind schedule — but more safely.");
            } else {
                gs.slowedForIce = false;
                gs.addLog("The Captain decides to maintain full speed.");
                gs.addLog("(Historically, Captain Smith made the same choice.)");
                gs.addLog("Iceberg Alley will be more dangerous.");
            }
        }

        void showFullStatus() {
            StringBuilder sb = new StringBuilder("<html><body style='font-family:Serif;width:320px'>");
            sb.append("<h2 style='color:#D4AF37'>Passenger Status — "+gs.dateStr()+"</h2>");
            for (int i=0;i<5;i++) {
                String hbar = "";
                if (gs.alive[i]) {
                    int filled = gs.health[i]/10;
                    for (int j=0;j<10;j++) hbar += j<filled ? "█" : "░";
                }
                String color = !gs.alive[i]?"#888888":gs.health[i]>=60?"#40A050":gs.health[i]>=30?"#C8A000":"#BE2020";
                sb.append("<b>").append(gs.names[i]).append("</b>: ");
                if (gs.alive[i])
                    sb.append("<span style='color:").append(color).append("'>").append(hbar).append(" ").append(gs.health[i]).append("%</span>");
                else
                    sb.append("<span style='color:#888888'>Deceased</span>");
                sb.append("<br>");
            }
            sb.append("<br><b style='color:#D4AF37'>Resources:</b><br>");
            sb.append("Food: ").append(gs.food).append(" lbs<br>");
            sb.append("Coal: ").append(gs.coal).append(" tons<br>");
            sb.append("Medicine: ").append(gs.medicine).append(" doses<br>");
            sb.append("Money: ").append(gs.money).append(" shillings<br>");
            sb.append("Lifeboat seats: ").append(gs.lifeboats).append("<br>");
            sb.append("</body></html>");
            JOptionPane.showMessageDialog(frame, new JLabel(sb.toString()),
                "Full Status Report", JOptionPane.INFORMATION_MESSAGE);
        }

        // ── Random events ─────────────────────────────────────────────────
        void fireRandomEvent() {
            int type = RNG.nextInt(24);
            switch(type) {
                case 0:  eventSeasick(); break;
                case 1:  eventIllness(); break;
                case 2:  eventStorm(); break;
                case 3:  eventCalm(); break;
                case 4:  eventBoilerProblem(); break;
                case 5:  eventFoodSpoil(); break;
                case 6:  eventManOverboard(); break;
                case 7:  eventDinner(); break;
                case 8:  eventStowaway(); break;
                case 9:  eventFog(); break;
                case 10: eventWhale(); break;
                case 11: eventCardGame(); break;
                case 12: eventTelegram(); break;
                case 13: eventInjury(); break;
                case 14: eventMedicine(); break;
                case 15: eventSmallFire(); break;
                case 16: eventRecovery(); break;
                case 17: eventGoodFood(); break;
                case 18: eventSisterShip(); break;
                case 19: eventColdSnap(); break;
                default: break; // calm
            }
        }

        void eventSeasick() {
            int p = alivePax();
            gs.addLog("» "+gs.names[p]+" is terribly seasick. Loses appetite.");
            gs.health[p] = Math.max(5, gs.health[p]-12);
        }
        void eventIllness() {
            int p = alivePax();
            boolean hasMed = gs.medicine > 0;
            if (hasMed) {
                int r = JOptionPane.showOptionDialog(frame,
                    gs.names[p]+" has fallen ill with a fever.\n\nUse 1 dose of medicine?",
                    "Illness",JOptionPane.YES_NO_OPTION,JOptionPane.QUESTION_MESSAGE,
                    null,new String[]{"Use Medicine","Hope for Recovery"},"Use Medicine");
                if (r==0) { gs.medicine--; gs.addLog("» "+gs.names[p]+" treated with medicine. Feeling better."); }
                else {
                    if (RNG.nextBoolean()) gs.addLog("» "+gs.names[p]+" recovers on their own.");
                    else { gs.health[p] = Math.max(5,gs.health[p]-25); gs.addLog("» "+gs.names[p]+"'s condition worsens. Health drops."); }
                }
            } else {
                gs.health[p] = Math.max(5,gs.health[p]-25);
                gs.addLog("» "+gs.names[p]+" is ill — no medicine available. Health declines.");
            }
        }
        void eventStorm() {
            gs.addLog("» A fierce Atlantic storm! The ship pitches wildly.");
            gs.addLog("  All passengers confined to cabins. Extra coal burned.");
            gs.coal = Math.max(0, gs.coal-40);
            for (int i=0;i<5;i++) if (gs.alive[i]) gs.health[i]=Math.max(5,gs.health[i]-10);
        }
        void eventCalm() {
            gs.addLog("» Calm seas and a brilliant sky. Excellent sailing conditions!");
            gs.progress = Math.min(100, gs.progress+2);
        }
        void eventBoilerProblem() {
            gs.addLog("» A boiler overheats in the engine room. Engineers work through the night.");
            gs.coal = Math.max(0, gs.coal-60);
        }
        void eventFoodSpoil() {
            int lost = 30 + RNG.nextInt(40);
            gs.food = Math.max(0, gs.food-lost);
            gs.addLog("» "+lost+" lbs of food found spoiled in the larder. Discarded.");
        }
        void eventManOverboard() {
            int p = alivePax();
            gs.addLog("» ALARM! "+gs.names[p]+" has gone overboard!");
            int r = JOptionPane.showOptionDialog(frame,
                gs.names[p]+" has fallen overboard!\nThe water is near freezing.\n\nThrow a life ring immediately?",
                "Man Overboard!",JOptionPane.YES_NO_OPTION,JOptionPane.WARNING_MESSAGE,
                null,new String[]{"Throw Life Ring","Signal the Bridge"},null);
            if (r==0 || RNG.nextBoolean()) {
                gs.addLog("  "+gs.names[p]+" is rescued! Severely hypothermic but alive.");
                gs.health[p] = Math.max(10, gs.health[p]-35);
            } else {
                gs.alive[p]=false; gs.health[p]=0;
                gs.addLog("  Despite efforts, "+gs.names[p]+" could not be saved.");
            }
        }
        void eventDinner() {
            if (gs.shipClass==1) {
                gs.addLog("» Captain Smith hosts an elegant dinner in the First Class dining saloon.");
                gs.addLog("  Fine food and wine lifts everyone's spirits.");
                for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+10);
            } else if (gs.shipClass==2) {
                gs.addLog("» A pleasant evening meal in the Second Class dining room.");
                for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+5);
            } else {
                gs.addLog("» The steerage passengers share a hearty meal and traditional music.");
                for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+3);
            }
        }
        void eventStowaway() {
            int r = JOptionPane.showOptionDialog(frame,
                "A young stowaway has been discovered\nhiding in a lifeboat!\n\nWhat do you do?",
                "Stowaway Found",JOptionPane.YES_NO_OPTION,JOptionPane.QUESTION_MESSAGE,
                null,new String[]{"Report to Ship's Officers","Keep the Secret"},null);
            if (r==0) gs.addLog("» Stowaway reported. They are escorted to steerage to work their passage.");
            else {
                gs.addLog("» You sneak the stowaway extra food. They are grateful.");
                gs.food=Math.max(0,gs.food-20);
                for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+4);
            }
        }
        void eventFog() {
            gs.addLog("» Dense fog rolls in. Captain orders the foghorn and reduced speed.");
            gs.progress = Math.max(0, gs.progress-2);
        }
        void eventWhale() {
            gs.addLog("» A pod of blue whales spotted off the starboard bow!");
            gs.addLog("  Passengers rush to the railing for a magnificent view.");
        }
        void eventCardGame() {
            if (gs.money > 20) {
                int r = JOptionPane.showOptionDialog(frame,
                    "A high-stakes card game is underway\nin the smoking room.\n\nJoin in?",
                    "Card Game",JOptionPane.YES_NO_OPTION,JOptionPane.QUESTION_MESSAGE,
                    null,new String[]{"Join the Game","Decline"},null);
                if (r==0) {
                    if (RNG.nextBoolean()) {
                        int win=20+RNG.nextInt(40); gs.money+=win;
                        gs.addLog("» Luck is on your side! You win "+win+" shillings.");
                    } else {
                        int lose=20+RNG.nextInt(30); gs.money=Math.max(0,gs.money-lose);
                        gs.addLog("» The cards turn against you. You lose "+lose+" shillings.");
                    }
                } else gs.addLog("» You watch from the doorway. Probably wise.");
            } else gs.addLog("» A card game is in progress, but you lack the funds to participate.");
        }
        void eventTelegram() {
            String[] msgs = {
                "» Wireless: Message from home — all is well.",
                "» Wireless: SS Amerika reports 'Two large icebergs in Lat 41° 27'N.'",
                "» Wireless: 'Congratulations on the Titanic's splendid speed!' — Olympic",
                "» Wireless: SS Mesaba: 'Ice report: Heavy pack ice and a great number of icebergs.'",
                "» Wireless: A stock market update for First Class investors. Mixed results.",
            };
            gs.addLog(msgs[RNG.nextInt(msgs.length)]);
        }
        void eventInjury() {
            int p = alivePax();
            gs.addLog("» "+gs.names[p]+" slips on the wet deck and injures an ankle.");
            gs.health[p]=Math.max(5,gs.health[p]-15);
        }
        void eventMedicine() {
            gs.medicine++;
            gs.addLog("» The ship's doctor shares a spare dose of medicine with your party.");
        }
        void eventSmallFire() {
            gs.addLog("» A small fire breaks out in Coal Bunker #6! Quickly controlled.");
            gs.addLog("  Approximately 50 tons of coal lost, but the ship is safe.");
            gs.coal=Math.max(0,gs.coal-50);
        }
        void eventRecovery() {
            int p = alivePax();
            gs.addLog("» "+gs.names[p]+" has been resting and feels much better today.");
            gs.health[p]=Math.min(100,gs.health[p]+18);
        }
        void eventGoodFood() {
            gs.addLog("» The galley produces an especially fine meal today. Spirits rise.");
            for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+6);
        }
        void eventSisterShip() {
            gs.addLog("» The RMS Olympic — Titanic's sister ship — is spotted on the horizon!");
            gs.addLog("  Wireless operators exchange friendly messages. A beautiful sight.");
        }
        void eventColdSnap() {
            gs.addLog("» Temperatures plunge far below freezing. An eerie chill on deck.");
            if (gs.rations==1) {
                for (int i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.max(5,gs.health[i]-8);
                gs.addLog("  Meager rations give little warmth. Everyone suffers.");
            } else {
                gs.addLog("  You huddle together and stay warm.");
            }
        }

        int alivePax() {
            List<Integer> live = new ArrayList<>();
            for (int i=0;i<5;i++) if(gs.alive[i]) live.add(i);
            return live.isEmpty()?0:live.get(RNG.nextInt(live.size()));
        }

        // ── Inner map strip ───────────────────────────────────────────────
        class MapStrip extends JPanel {
            MapStrip() { setBackground(C_OCEAN); }
            @Override protected void paintComponent(Graphics g) {
                super.paintComponent(g);
                Graphics2D g2=(Graphics2D)g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
                int w=getWidth(),h=getHeight();
                // Ocean background
                GradientPaint bg=new GradientPaint(0,0,new Color(5,15,45),0,h,C_OCEAN2);
                g2.setPaint(bg); g2.fillRect(0,0,w,h);
                g2.setColor(C_GOLD); g2.setStroke(new BasicStroke(1));
                g2.drawRect(1,1,w-2,h-2);

                // Route line
                int y=h/2+5;
                g2.setColor(new Color(100,130,200,120));
                g2.setStroke(new BasicStroke(2,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND,0,new float[]{6,4},0));
                g2.drawLine(30,y,w-30,y);

                // Waypoints
                int[] progPts={0, GameState.T_CHERBOURG, GameState.T_QUEENSTOWN, 50, 80, 100};
                String[] portNames={"Southampton","Cherbourg","Queenstown","Open Atlantic","Grand Banks","New York"};
                for (int i=0;i<progPts.length;i++) {
                    int px=30+(w-60)*progPts[i]/100;
                    boolean passed=gs.progress>=progPts[i];
                    g2.setColor(passed?C_GOLD:C_DIM);
                    g2.fillOval(px-4,y-4,8,8);
                    g2.setFont(new Font("SansSerif",Font.PLAIN,9));
                    FontMetrics fm=g2.getFontMetrics();
                    int tw=fm.stringWidth(portNames[i]);
                    g2.drawString(portNames[i],px-tw/2,y+(i%2==0?-8:18));
                }

                // Ship icon
                int shipX=30+(w-60)*gs.progress/100;
                drawMiniShip(g2, shipX, y-10);

                // Title
                g2.setFont(new Font("Serif",Font.BOLD,13));
                g2.setColor(C_GOLD);
                g2.drawString("VOYAGE PROGRESS: "+gs.progress+"%  |  "+gs.dateStr(),8,14);
            }
            void drawMiniShip(Graphics2D g2,int x,int y) {
                g2.setColor(new Color(220,210,180));
                int[] hx={x-12,x-10,x+12,x+14,x+10,x-10};
                int[] hy={y+8,y+12,y+12,y+6,y+4,y+4};
                g2.fillPolygon(hx,hy,6);
                g2.setColor(new Color(60,60,80));
                g2.fillRect(x-6,y-2,12,6);
                g2.setColor(new Color(160,50,20));
                g2.fillRect(x-4,y-8,5,7);
                g2.fillRect(x+2,y-8,5,7);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORE PANEL
    // ─────────────────────────────────────────────────────────────────────────
    static class StorePanel extends JPanel {
        String portName;
        JLabel moneyLabel;

        StorePanel(String port) {
            this.portName = port;
            setBackground(C_OCEAN);
            setLayout(new BorderLayout(10,10));
            setBorder(BorderFactory.createEmptyBorder(20,30,20,30));
            build();
        }

        void build() {
            JLabel title = new JLabel("Port of "+portName, SwingConstants.CENTER);
            title.setFont(new Font("Serif", Font.BOLD, 28));
            title.setForeground(C_GOLD);
            add(title, BorderLayout.NORTH);

            JPanel center = new JPanel(new GridLayout(1,2,20,0));
            center.setOpaque(false);

            // Store items
            JPanel storePanel = new JPanel();
            storePanel.setLayout(new BoxLayout(storePanel, BoxLayout.Y_AXIS));
            storePanel.setBackground(C_PANEL);
            storePanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(C_GOLD,1),
                BorderFactory.createEmptyBorder(12,15,12,15)));

            JLabel shopTitle = new JLabel("Dock Market");
            shopTitle.setFont(new Font("Serif",Font.BOLD,18)); shopTitle.setForeground(C_GOLD);
            shopTitle.setAlignmentX(LEFT_ALIGNMENT);
            storePanel.add(shopTitle);
            storePanel.add(Box.createVerticalStrut(8));

            Object[][] items = {
                {"Food (50 lbs)",    "20 shillings", 20, "food",   50},
                {"Food (100 lbs)",   "35 shillings", 35, "food",  100},
                {"Coal (100 tons)",  "30 shillings", 30, "coal",  100},
                {"Coal (200 tons)",  "55 shillings", 55, "coal",  200},
                {"Medicine (2 doses)","25 shillings",25,"medicine",2},
                {"Extra Lifeboat Seat","60 shillings",60,"lifeboats",1},
            };

            for (Object[] item : items) {
                JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT,8,2));
                row.setOpaque(false);
                JButton buyBtn = styledBtn("Buy", new Color(40,80,40));
                buyBtn.setFont(new Font("SansSerif",Font.BOLD,11));
                JLabel itemLbl = new JLabel("<html><b>"+item[0]+"</b> — "+item[1]+"</html>");
                itemLbl.setFont(new Font("Serif",Font.PLAIN,13));
                itemLbl.setForeground(C_TEXT);
                final int cost=(Integer)item[2];
                final String key=(String)item[3];
                final int amt=(Integer)item[4];
                buyBtn.addActionListener(e -> purchase(key, amt, cost));
                row.add(buyBtn); row.add(itemLbl);
                storePanel.add(row);
            }
            center.add(storePanel);

            // Status
            JPanel statusPanel = new JPanel();
            statusPanel.setLayout(new BoxLayout(statusPanel, BoxLayout.Y_AXIS));
            statusPanel.setBackground(C_PANEL);
            statusPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(C_GOLD,1),
                BorderFactory.createEmptyBorder(12,15,12,15)));

            JLabel statTitle = new JLabel("Current Stores");
            statTitle.setFont(new Font("Serif",Font.BOLD,18)); statTitle.setForeground(C_GOLD);
            statTitle.setAlignmentX(LEFT_ALIGNMENT);
            statusPanel.add(statTitle);
            statusPanel.add(Box.createVerticalStrut(10));

            moneyLabel = mkLbl("Money: "+gs.money+" shillings", C_GOLD, Font.BOLD, 14);
            statusPanel.add(moneyLabel);
            statusPanel.add(Box.createVerticalStrut(8));
            statusPanel.add(mkLbl("Food:     "+gs.food+" lbs",C_TEXT,Font.PLAIN,13));
            statusPanel.add(mkLbl("Coal:     "+gs.coal+" tons",C_TEXT,Font.PLAIN,13));
            statusPanel.add(mkLbl("Medicine: "+gs.medicine+" doses",C_TEXT,Font.PLAIN,13));
            statusPanel.add(mkLbl("Lifeboats:"+gs.lifeboats+" seats",C_TEXT,Font.PLAIN,13));
            statusPanel.add(Box.createVerticalStrut(12));

            String portNote = portName.contains("Queenstown") ?
                "<html><i>This is the last port before<br>the open North Atlantic.<br>Stock up wisely!</i></html>" :
                "<html><i>Next stop: Queenstown, Ireland.<br>The last port before<br>the open ocean.</i></html>";
            JLabel note = new JLabel(portNote);
            note.setFont(new Font("Serif",Font.ITALIC,13));
            note.setForeground(C_DIM);
            note.setAlignmentX(LEFT_ALIGNMENT);
            statusPanel.add(note);
            center.add(statusPanel);
            add(center, BorderLayout.CENTER);

            JPanel bottom = new JPanel(new FlowLayout());
            bottom.setOpaque(false);
            JButton leaveBtn = styledBtn("  Depart Port  ", new Color(60,40,20));
            leaveBtn.setFont(new Font("Serif",Font.BOLD,16));
            leaveBtn.addActionListener(e -> { gs.addLog("Departing "+portName+". The voyage continues."); goTo(new VoyagePanel()); });
            bottom.add(leaveBtn);
            add(bottom, BorderLayout.SOUTH);
        }

        void purchase(String key, int amt, int cost) {
            if (gs.money < cost) {
                JOptionPane.showMessageDialog(frame,"You cannot afford that.","Insufficient Funds",JOptionPane.WARNING_MESSAGE);
                return;
            }
            gs.money -= cost;
            switch(key) {
                case "food":      gs.food += amt; break;
                case "coal":      gs.coal += amt; break;
                case "medicine":  gs.medicine += amt; break;
                case "lifeboats": gs.lifeboats += amt; break;
            }
            gs.addLog("Purchased: "+amt+" "+key+" for "+cost+" shillings.");
            moneyLabel.setText("Money: "+gs.money+" shillings");
            repaint();
        }

        JLabel mkLbl(String t, Color c, int s, int sz) {
            JLabel l=new JLabel(t); l.setFont(new Font("Serif",s,sz)); l.setForeground(c);
            l.setAlignmentX(LEFT_ALIGNMENT); return l;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ICEBERG PANEL  (action mini-game)
    // ─────────────────────────────────────────────────────────────────────────
    static class IcebergPanel extends JPanel implements ActionListener {
        static final int SHIP_W=60, SHIP_H=25;
        static final int ICE_MIN_W=30, ICE_MAX_W=90;

        int shipX;
        int hull = 100;
        int timeLeft = 120; // seconds
        int tick = 0;       // counts timer ticks (each 50ms)
        boolean gameOver = false;
        boolean survived = false;
        String gameOverMsg = "";

        List<int[]> icebergs = new ArrayList<>(); // {x,y,w,h,dx}
        Random rng = new Random();

        boolean leftKey=false, rightKey=false;
        javax.swing.Timer timer;

        // Stars (fixed)
        int[] starX = new int[150];
        int[] starY = new int[150];
        float[] starB= new float[150];

        IcebergPanel() {
            setBackground(Color.BLACK);
            setFocusable(true);

            Random rngS=new Random(42);
            for(int i=0;i<150;i++){starX[i]=rngS.nextInt(820);starY[i]=rngS.nextInt(300);starB[i]=(float)rngS.nextDouble();}

            addKeyListener(new KeyAdapter(){
                public void keyPressed(KeyEvent e){
                    if(e.getKeyCode()==KeyEvent.VK_LEFT)  leftKey=true;
                    if(e.getKeyCode()==KeyEvent.VK_RIGHT) rightKey=true;
                }
                public void keyReleased(KeyEvent e){
                    if(e.getKeyCode()==KeyEvent.VK_LEFT)  leftKey=false;
                    if(e.getKeyCode()==KeyEvent.VK_RIGHT) rightKey=false;
                }
            });

            timer = new javax.swing.Timer(50, this);
        }

        @Override public void addNotify(){
            super.addNotify();
            shipX = getPreferredSize().width/2;
            if(shipX==0) shipX=400;
            requestFocusInWindow();
            timer.start();
        }

        @Override public void actionPerformed(ActionEvent e) {
            if(gameOver) return;
            tick++;
            int W = getWidth(); if(W==0) W=820;
            int H = getHeight(); if(H==0) H=620;

            // Move ship
            int spd = 6;
            if(leftKey)  shipX = Math.max(SHIP_W/2+5, shipX-spd);
            if(rightKey) shipX = Math.min(W-SHIP_W/2-5, shipX+spd);

            // Spawn icebergs every ~1.5s, more frequent over time
            int spawnRate = Math.max(8, 30 - (120-timeLeft)/5);
            if(tick % spawnRate == 0) {
                int iw = ICE_MIN_W + rng.nextInt(ICE_MAX_W - ICE_MIN_W);
                int ih = 25 + rng.nextInt(30);
                int ix = rng.nextInt(W - iw);
                int idx = rng.nextInt(5)-2; // -2 to +2 drift
                icebergs.add(new int[]{ix, -ih, iw, ih, idx});
            }

            // Move icebergs
            int iceSpeed = 3 + (120-timeLeft)/20;
            Iterator<int[]> it = icebergs.iterator();
            int shipTop = H - 80;
            while(it.hasNext()) {
                int[] ice = it.next();
                ice[1] += iceSpeed;
                ice[0] += ice[4];
                // Bounce off walls
                if(ice[0]<0){ice[0]=0;ice[4]*=-1;}
                if(ice[0]+ice[2]>W){ice[0]=W-ice[2];ice[4]*=-1;}
                // Off-screen: remove
                if(ice[1] > H) { it.remove(); continue; }
                // Collision check
                if(!gameOver && ice[1]+ice[3] >= shipTop && ice[1] <= shipTop+SHIP_H) {
                    int iceL=ice[0], iceR=ice[0]+ice[2];
                    int shipL=shipX-SHIP_W/2, shipR=shipX+SHIP_W/2;
                    if(iceR>shipL && iceL<shipR) {
                        it.remove();
                        hull -= 30;
                        gs.icebergHits++;
                        if(hull<=0) {
                            hull=0; gameOver=true; survived=false;
                            gs.sank=true;
                            gameOverMsg="The Titanic has sunk!";
                            timer.stop();
                        }
                    }
                }
            }

            // Countdown every 20 ticks (1 second)
            if(tick % 20 == 0) {
                timeLeft--;
                if(timeLeft <= 0) {
                    gameOver=true; survived=true;
                    gameOverMsg="You navigated through Iceberg Alley!";
                    timer.stop();
                }
            }

            repaint();

            if(gameOver) {
                timer.stop();
                final boolean s = survived;
                SwingUtilities.invokeLater(()->{
                    String msg = s ?
                        "By some miracle, the Titanic navigated safely\nthrough Iceberg Alley!\n\nThe ship arrives in New York, April 17, 1912." :
                        "The Titanic has struck an iceberg and is sinking!\n\nYou have "+gs.lifeboats+" lifeboat seats\nfor "+gs.aliveCount()+" passengers.";
                    JOptionPane.showMessageDialog(frame, msg,
                        s?"SAFE PASSAGE!":"SHIP SINKING!",
                        s?JOptionPane.INFORMATION_MESSAGE:JOptionPane.ERROR_MESSAGE);
                    goTo(new EndingPanel());
                });
            }
        }

        @Override protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2=(Graphics2D)g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            int W=getWidth(), H=getHeight();

            // Night sky
            GradientPaint sky=new GradientPaint(0,0,new Color(2,2,15),0,H*3/5,new Color(5,20,50));
            g2.setPaint(sky); g2.fillRect(0,0,W,H*3/5);
            // Ocean
            GradientPaint sea=new GradientPaint(0,H*3/5,new Color(5,20,55),0,H,new Color(0,10,35));
            g2.setPaint(sea); g2.fillRect(0,H*3/5,W,H*2/5);

            // Stars
            for(int i=0;i<150;i++){
                float bv=(float)(0.3+0.7*Math.abs(Math.sin(tick*0.02+starB[i]*10)));
                g2.setColor(new Color(1f,1f,1f,bv));
                g2.fillOval(starX[i],starY[i],2,2);
            }

            // Moon
            g2.setColor(new Color(255,248,200,180));
            g2.fillOval(W-90,20,50,50);
            g2.setColor(new Color(2,2,15,220));
            g2.fillOval(W-78,16,50,50);

            // Moon reflection on water
            g2.setColor(new Color(255,248,150,25));
            g2.fillRect(W-80,H*3/5,35,H);

            // Draw icebergs
            for(int[] ice : icebergs) drawIceberg(g2,ice[0],ice[1],ice[2],ice[3]);

            // Draw ship
            int shipY = H - 80;
            drawShipMini(g2, shipX, shipY);

            // Ship's wake
            g2.setColor(new Color(100,160,255,40));
            for(int i=1;i<=4;i++) g2.fillOval(shipX-SHIP_W/2-i*3,shipY+SHIP_H-3,SHIP_W+i*6,6);

            // HUD
            drawHUD(g2, W, H);

            // Collision flash
            if(hull<70 && !gameOver && (tick/3)%2==0) {
                g2.setColor(new Color(200,0,0,30));
                g2.fillRect(0,0,W,H);
            }
        }

        void drawIceberg(Graphics2D g2, int x, int y, int w, int h) {
            // Underwater mass (larger, dark blue)
            g2.setColor(new Color(20,60,110,150));
            g2.fillOval(x-w/6, y+h/2, w+w/3, h);
            // Main body
            int[] px={x+w/4,x,x+w/6,x+w*2/3,x+w,x+w*3/4};
            int[] py={y,y+h/2,y+h,y+h,y+h/2,y};
            GradientPaint icePaint=new GradientPaint(x,y,new Color(220,240,255),x+w,y+h,new Color(160,210,240));
            g2.setPaint(icePaint); g2.fillPolygon(px,py,6);
            // Highlight
            g2.setColor(new Color(255,255,255,150));
            g2.setStroke(new BasicStroke(1.5f));
            g2.drawLine(x+w/4,y,x+w/6,y+h/3);
            g2.drawLine(x+w/6,y+h/3,x+w*5/12,y+h*2/3);
            // Shadow
            g2.setColor(new Color(100,160,220,80));
            int[] sx={x+w*2/3,x+w,x+w*3/4,x+w*7/12};
            int[] sy={y+h,y+h/2,y,y+h/3};
            g2.fillPolygon(sx,sy,4);
        }

        void drawShipMini(Graphics2D g2, int cx, int y) {
            // Hull
            int[] hx={cx-SHIP_W/2,cx-SHIP_W/2+5,cx+SHIP_W/2-10,cx+SHIP_W/2,cx+SHIP_W/2-5,cx-SHIP_W/2+3};
            int[] hy={y+4,y+SHIP_H,y+SHIP_H,y+2,y-2,y-2};
            g2.setColor(new Color(20,20,40)); g2.fillPolygon(hx,hy,6);
            // White stripe
            g2.setColor(new Color(200,195,180,200));
            g2.setStroke(new BasicStroke(1.5f));
            g2.drawLine(cx-SHIP_W/2+5,y+2,cx+SHIP_W/2-4,y+2);
            // Superstructure
            g2.setColor(new Color(185,180,165));
            g2.fillRect(cx-14,y-14,28,14);
            // Funnels
            g2.setColor(new Color(15,15,35));
            g2.fillRect(cx-10,y-22,6,10);
            g2.fillRect(cx+4,y-22,6,10);
            g2.setColor(new Color(170,55,20));
            g2.fillRect(cx-10,y-25,6,5);
            g2.fillRect(cx+4,y-25,6,5);
            // Smoke
            g2.setColor(new Color(80,80,100,120));
            g2.fillOval(cx-12,y-38,10,18);
            g2.fillOval(cx+2,y-38,10,18);
        }

        void drawHUD(Graphics2D g2, int W, int H) {
            // Hull integrity bar
            g2.setFont(new Font("SansSerif",Font.BOLD,13));
            g2.setColor(Color.WHITE);
            g2.drawString("HULL INTEGRITY",10,20);
            g2.setColor(new Color(40,40,40));
            g2.fillRect(10,24,200,16);
            Color barColor = hull>60?C_GREEN:hull>30?C_GOLD:C_RED;
            g2.setColor(barColor);
            g2.fillRect(10,24,hull*2,16);
            g2.setColor(Color.WHITE);
            g2.setStroke(new BasicStroke(1));
            g2.drawRect(10,24,200,16);
            g2.setFont(new Font("SansSerif",Font.BOLD,11));
            g2.drawString(hull+"%",218,37);

            // Time remaining
            g2.setFont(new Font("SansSerif",Font.BOLD,13));
            g2.setColor(Color.WHITE);
            String timeStr="TIME: "+timeLeft+"s";
            FontMetrics fm=g2.getFontMetrics();
            g2.drawString(timeStr, W-fm.stringWidth(timeStr)-10,20);

            // Title / instructions
            g2.setFont(new Font("Serif",Font.BOLD,16));
            g2.setColor(C_GOLD);
            String title="ICEBERG ALLEY — April 14, 1912 — 11:40 PM";
            fm=g2.getFontMetrics();
            g2.drawString(title,(W-fm.stringWidth(title))/2,18);
            g2.setFont(new Font("SansSerif",Font.PLAIN,11));
            g2.setColor(new Color(180,170,150));
            String inst="Arrow keys: STEER  |  Avoid icebergs!  |  Survive "+timeLeft+"s";
            fm=g2.getFontMetrics();
            g2.drawString(inst,(W-fm.stringWidth(inst))/2,34);

            // Hits
            g2.setFont(new Font("SansSerif",Font.BOLD,12));
            g2.setColor(C_RED);
            g2.drawString("Hits: "+gs.icebergHits,10,55);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FISHING PANEL  (action mini-game)
    // ─────────────────────────────────────────────────────────────────────────
    static class FishingPanel extends JPanel implements ActionListener {
        static final int WATER_Y = 130; // y-coord where ocean surface begins
        static final int HOOK_R  = 9;   // hook collision radius

        int hookX, hookY;   // hook position (within water area)
        int timeLeft = 45;
        int tick = 0;
        boolean gameOver = false;
        int fishFood  = 0;  // lbs of food earned
        int coalBonus = 0;  // tons of coal earned
        int catchCount = 0;

        // swimmers: {x, y, w, h, dx, type}
        // type 0=sardine(20lb) 1=cod(35lb) 2=tuna(50lb) 3=coal_barrel(+50 coal)
        List<int[]> swimmers = new ArrayList<>();
        // catch flashes: {x, y, label, ttl}
        List<Object[]> flashes = new ArrayList<>();
        // bubbles: {x, y}
        List<int[]> bubbles = new ArrayList<>();

        boolean leftKey=false, rightKey=false, upKey=false, downKey=false;
        javax.swing.Timer timer;
        Random rng = new Random();
        float wavePhase = 0f;

        FishingPanel() {
            setBackground(new Color(5, 40, 90));
            setFocusable(true);
            addKeyListener(new KeyAdapter() {
                public void keyPressed(KeyEvent e) {
                    if (e.getKeyCode()==KeyEvent.VK_LEFT)  leftKey=true;
                    if (e.getKeyCode()==KeyEvent.VK_RIGHT) rightKey=true;
                    if (e.getKeyCode()==KeyEvent.VK_UP)    upKey=true;
                    if (e.getKeyCode()==KeyEvent.VK_DOWN)  downKey=true;
                }
                public void keyReleased(KeyEvent e) {
                    if (e.getKeyCode()==KeyEvent.VK_LEFT)  leftKey=false;
                    if (e.getKeyCode()==KeyEvent.VK_RIGHT) rightKey=false;
                    if (e.getKeyCode()==KeyEvent.VK_UP)    upKey=false;
                    if (e.getKeyCode()==KeyEvent.VK_DOWN)  downKey=false;
                }
            });
            timer = new javax.swing.Timer(50, this);
        }

        @Override public void addNotify() {
            super.addNotify();
            int W=getWidth(); if(W==0) W=820;
            int H=getHeight(); if(H==0) H=620;
            hookX = W/2;
            hookY = WATER_Y + (H-WATER_Y)*6/10;
            requestFocusInWindow();
            timer.start();
        }

        @Override public void actionPerformed(ActionEvent e) {
            if (gameOver) return;
            tick++;
            int W=getWidth(); if(W==0) W=820;
            int H=getHeight(); if(H==0) H=620;

            // Move hook (4 directions, clamped to water area)
            int spd = 6;
            if (leftKey)  hookX = Math.max(HOOK_R+5, hookX-spd);
            if (rightKey) hookX = Math.min(W-HOOK_R-5, hookX+spd);
            if (upKey)    hookY = Math.max(WATER_Y+HOOK_R+5, hookY-spd);
            if (downKey)  hookY = Math.min(H-HOOK_R-5, hookY+spd);

            wavePhase += 0.06f;

            // Spawn fish every ~2s (40 ticks at 50ms)
            if (tick % 40 == 0) spawnFish(W, H);

            // Coal barrel: first at 3s, then periodically with some randomness
            if (tick == 60 || (tick > 60 && tick % 150 == 0 && rng.nextInt(3) > 0))
                spawnBarrel(W, H);

            // Rising bubbles near hook
            if (tick % 12 == 0) bubbles.add(new int[]{hookX+rng.nextInt(16)-8, hookY+8});
            for (Iterator<int[]> it=bubbles.iterator(); it.hasNext();) {
                int[] b=it.next(); b[1]-=2; if (b[1]<WATER_Y) it.remove();
            }

            // Move flashes, decrement ttl
            for (Iterator<Object[]> it=flashes.iterator(); it.hasNext();) {
                Object[] f=it.next();
                f[1]=(Integer)f[1]-3; // float up
                f[3]=(Integer)f[3]-1; // countdown
                if ((Integer)f[3]<=0) it.remove();
            }

            // Move swimmers and check collisions
            for (Iterator<int[]> it=swimmers.iterator(); it.hasNext();) {
                int[] s=it.next();
                s[0]+=s[4];
                if (s[0]<-s[2]-40 || s[0]>W+40) { it.remove(); continue; }
                // Circular collision: fish center vs hook center
                int fcx=s[0]+s[2]/2, fcy=s[1]+s[3]/2;
                int dx=fcx-hookX, dy=fcy-hookY;
                int r=(s[2]/2+HOOK_R);
                if (dx*dx+dy*dy < r*r) {
                    int type=s[5];
                    if (type==3) {
                        coalBonus+=50;
                        flashes.add(new Object[]{hookX, hookY, "+50 COAL!", 30});
                    } else {
                        int[] fv={20,35,50};
                        fishFood+=fv[type];
                        catchCount++;
                        flashes.add(new Object[]{hookX, hookY, "+"+fv[type]+" lbs", 25});
                    }
                    it.remove();
                }
            }

            // Countdown (20 ticks = 1 second)
            if (tick % 20 == 0 && --timeLeft <= 0) {
                gameOver=true; timer.stop();
            }

            repaint();

            if (gameOver) {
                final int food=fishFood, coal=coalBonus, catches=catchCount;
                SwingUtilities.invokeLater(()->{
                    gs.food = Math.max(0, gs.food+food);
                    gs.coal = Math.max(0, gs.coal+coal-10); // -10 for idle boiler
                    gs.lastFishDay = gs.dayNum;
                    gs.dayNum++;
                    String caughtStr = catches==1 ? "1 fish" : catches+" fish";
                    gs.addLog("» The crew spent the afternoon fishing off the stern.");
                    gs.addLog("  Caught "+caughtStr+" — "+food+" lbs of fresh fish added to stores.");
                    if (coal>0) gs.addLog("  Also hauled in a floating coal barrel! +"+coal+" tons.");
                    String msg = "Fishing Complete!\n\n"
                        +"Fish caught:  "+catches+"\n"
                        +"Food gained: +"+food+" lbs\n"
                        +(coal>0 ? "Coal bonus:  +"+coal+" tons\n" : "")
                        +"\nThe cook is delighted with the fresh Atlantic catch!";
                    JOptionPane.showMessageDialog(frame, msg,
                        "Fishing Results", JOptionPane.INFORMATION_MESSAGE);
                    goTo(new VoyagePanel());
                });
            }
        }

        void spawnFish(int W, int H) {
            // 50% sardine, 30% cod, 20% tuna
            int r=rng.nextInt(10);
            int type = r<5 ? 0 : r<8 ? 1 : 2;
            int[][] sizes={{28,11},{44,17},{58,21}};
            int[] speeds={5,3,2};
            int fw=sizes[type][0], fh=sizes[type][1];
            int minY=WATER_Y+25, maxY=H-fh-25;
            int fy=minY+rng.nextInt(Math.max(1,maxY-minY));
            int spd=speeds[type];
            if (rng.nextBoolean()) swimmers.add(new int[]{-fw,fy,fw,fh,spd,type});
            else                   swimmers.add(new int[]{W,  fy,fw,fh,-spd,type});
        }

        void spawnBarrel(int W, int H) {
            int bw=26, bh=22, by=WATER_Y+7;
            int spd=8+rng.nextInt(4); // fast! 8-11 px/tick
            if (rng.nextBoolean()) swimmers.add(new int[]{-bw,by,bw,bh,spd,3});
            else                   swimmers.add(new int[]{W,  by,bw,bh,-spd,3});
        }

        @Override protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2=(Graphics2D)g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            int W=getWidth(), H=getHeight();

            // Sky
            GradientPaint sky=new GradientPaint(0,0,new Color(100,165,225),0,WATER_Y,new Color(170,215,250));
            g2.setPaint(sky); g2.fillRect(0,0,W,WATER_Y);

            // Clouds (slowly drifting)
            g2.setColor(new Color(255,255,255,190));
            drawCloud(g2,(int)(tick*0.4f+50)%(W+180)-90, 18, 80);
            drawCloud(g2,(int)(tick*0.25f+320)%(W+180)-90, 38, 55);
            drawCloud(g2,(int)(tick*0.35f+650)%(W+180)-90, 22, 65);

            // Ship deck railing
            g2.setColor(new Color(55,40,25));
            g2.fillRect(0,WATER_Y-20,W,9);
            g2.setColor(new Color(80,58,36));
            for (int px=8;px<W;px+=44) g2.fillRect(px,WATER_Y-34,5,22);
            g2.setColor(new Color(95,72,48));
            g2.fillRect(0,WATER_Y-36,W,4);

            // Fishing pole
            int poleBaseX=W/2-90, poleBaseY=WATER_Y-28;
            int poleTipX =W/2-18, poleTipY =WATER_Y-82;
            g2.setColor(new Color(105,65,28));
            g2.setStroke(new BasicStroke(4f,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND));
            g2.drawLine(poleBaseX,poleBaseY,poleTipX,poleTipY);
            // Fishing line from pole tip to hook
            g2.setColor(new Color(220,210,190,210));
            g2.setStroke(new BasicStroke(1f));
            g2.drawLine(poleTipX,poleTipY,hookX,WATER_Y);
            g2.drawLine(hookX,WATER_Y,hookX,hookY);

            // Water (underwater)
            GradientPaint water=new GradientPaint(0,WATER_Y,new Color(15,85,160),0,H,new Color(3,22,60));
            g2.setPaint(water); g2.fillRect(0,WATER_Y,W,H-WATER_Y);

            // Surface shimmer
            g2.setColor(new Color(180,225,255,65));
            for (int wx=-20;wx<W+20;wx+=38) {
                int wo=(int)(6*Math.sin(wavePhase+wx*0.08f));
                g2.fillOval(wx,WATER_Y-5+wo,30,10);
            }

            // God-rays from surface
            g2.setColor(new Color(200,235,255,12));
            for (int rx=60;rx<W;rx+=130) {
                int rw=50; int rx2=rx+rw;
                g2.fillPolygon(new int[]{rx,rx+rw/2,rx2+rw/2,rx2},
                               new int[]{WATER_Y,WATER_Y,H,H},4);
            }

            // Seaweed at bottom
            g2.setStroke(new BasicStroke(2f));
            for (int sx=20;sx<W;sx+=55) {
                int swH=20+(sx%45);
                g2.setColor(new Color(18,95,45,170));
                for (int sy=H-swH;sy<H;sy+=5) {
                    int swx=sx+(int)(7*Math.sin(wavePhase+sy*0.12f+sx*0.05f));
                    g2.fillOval(swx-2,sy,5,5);
                }
            }

            // Bubbles
            g2.setColor(new Color(200,235,255,90));
            g2.setStroke(new BasicStroke(1f));
            for (int[] b:bubbles) g2.drawOval(b[0]-3,b[1]-3,6,6);

            // Draw swimmers
            for (int[] s:swimmers) drawSwimmer(g2,s);

            // Draw hook
            drawHook(g2,hookX,hookY);

            // Catch flash labels
            for (Object[] fl:flashes) {
                int ttl=(Integer)fl[3];
                float alpha=Math.min(1f, ttl/10f);
                g2.setFont(new Font("SansSerif",Font.BOLD,13));
                String lbl=(String)fl[2];
                Color fc=lbl.contains("COAL") ? new Color(212,175,55,(int)(alpha*255))
                                              : new Color(80,220,80,(int)(alpha*255));
                g2.setColor(fc);
                g2.drawString(lbl,(Integer)fl[0]+8,(Integer)fl[1]);
            }

            // HUD on top
            drawFishHUD(g2,W,H);
        }

        void drawCloud(Graphics2D g2, int x, int y, int size) {
            g2.fillOval(x,y,size,size/2);
            g2.fillOval(x+size/4,y-size/4,size*2/3,size*2/3);
            g2.fillOval(x+size/2,y,size/2,size/3);
        }

        void drawSwimmer(Graphics2D g2, int[] s) {
            int x=s[0],y=s[1],w=s[2],h=s[3],type=s[5];
            boolean right=s[4]>0;

            if (type==3) {
                // Coal barrel — fast, near surface, glowing label
                GradientPaint bp=new GradientPaint(x,y,new Color(85,58,30),x+w,y+h,new Color(42,25,10));
                g2.setPaint(bp);
                g2.fillRoundRect(x,y,w,h,6,6);
                g2.setColor(new Color(52,32,14));
                g2.setStroke(new BasicStroke(2f));
                g2.drawLine(x,y+h/3,x+w,y+h/3);
                g2.drawLine(x,y+h*2/3,x+w,y+h*2/3);
                g2.setColor(new Color(175,145,75));
                g2.setStroke(new BasicStroke(1.5f));
                g2.drawRoundRect(x,y,w,h,6,6);
                g2.setFont(new Font("SansSerif",Font.BOLD,7));
                g2.setColor(C_GOLD);
                g2.drawString("COAL",x+3,y+h/2+3);
                // Speed trail
                g2.setColor(new Color(200,200,100,50));
                int tx2=right?x-14:x+w;
                g2.fillRect(tx2,y+3,14,h-6);
                return;
            }

            // Fish
            Color[] cols={new Color(170,215,245),new Color(165,128,72),new Color(28,108,55)};
            Color fc=cols[type];

            // Body oval
            g2.setColor(fc);
            g2.fillOval(x,y,w,h);
            // Belly highlight
            int br=Math.min(255,fc.getRed()+45), bg2=Math.min(255,fc.getGreen()+45), bb=Math.min(255,fc.getBlue()+45);
            g2.setColor(new Color(br,bg2,bb,170));
            g2.fillOval(x+w/4,y+h/4,w/2,h/2);

            // Tail
            int tailX=right?x:x+w;
            int[] tx={tailX,tailX+(right?-w/4:w/4),tailX+(right?-w/4:w/4)};
            int[] ty={y+h/2,y+1,y+h-1};
            g2.setColor(fc.darker());
            g2.fillPolygon(tx,ty,3);

            // Dorsal fin
            g2.setColor(fc.darker());
            g2.setStroke(new BasicStroke(1f));
            int[] fx={x+w*2/5,x+w/2,x+w*3/5};
            int[] fy={y,y-h*2/5,y};
            g2.drawPolyline(fx,fy,3);

            // Eye
            int eyeX=right?x+w*3/4-3:x+w/4-2;
            g2.setColor(Color.BLACK);
            g2.fillOval(eyeX,y+h/2-3,5,5);
            g2.setColor(new Color(230,230,230));
            g2.fillOval(eyeX+1,y+h/2-2,2,2);
        }

        void drawHook(Graphics2D g2, int x, int y) {
            g2.setColor(new Color(210,210,225,220));
            g2.setStroke(new BasicStroke(2.5f,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND));
            g2.drawArc(x-7,y-5,15,18,0,-210);
            g2.drawLine(x+8,y-5,x+8,y+6);
            g2.setColor(new Color(255,255,255,140));
            g2.setStroke(new BasicStroke(1f));
            g2.drawLine(x-6,y-2,x-3,y+3);
        }

        void drawFishHUD(Graphics2D g2, int W, int H) {
            g2.setFont(new Font("Serif",Font.BOLD,15));
            g2.setColor(C_GOLD);
            String title="NORTH ATLANTIC FISHING — April 1912";
            FontMetrics fm=g2.getFontMetrics();
            g2.drawString(title,(W-fm.stringWidth(title))/2,18);

            g2.setFont(new Font("SansSerif",Font.PLAIN,10));
            g2.setColor(new Color(180,170,150));
            String inst="Arrow keys: MOVE HOOK  |  Intercept fish to catch them!  |  Fast coal barrels near the surface = bonus coal!";
            fm=g2.getFontMetrics();
            g2.drawString(inst,(W-fm.stringWidth(inst))/2,31);

            // Timer (top right) — red when low
            g2.setFont(new Font("SansSerif",Font.BOLD,13));
            g2.setColor(timeLeft<=10?C_RED:Color.WHITE);
            String tstr="TIME: "+timeLeft+"s";
            fm=g2.getFontMetrics();
            g2.drawString(tstr,W-fm.stringWidth(tstr)-10,18);

            // Catch stats (top left)
            g2.setFont(new Font("SansSerif",Font.BOLD,12));
            g2.setColor(C_GREEN);
            g2.drawString("Fish: "+catchCount+"   Food: +"+fishFood+" lbs",10,18);
            if (coalBonus>0) {
                g2.setColor(C_GOLD);
                g2.drawString("Coal bonus: +"+coalBonus+" tons!",10,33);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDING PANEL
    // ─────────────────────────────────────────────────────────────────────────
    static class EndingPanel extends JPanel {
        EndingPanel() {
            setBackground(C_OCEAN);
            setLayout(new BorderLayout());
            build();
        }

        void build() {
            JPanel center = new JPanel();
            center.setLayout(new BoxLayout(center, BoxLayout.Y_AXIS));
            center.setOpaque(false);
            center.setBorder(BorderFactory.createEmptyBorder(20,60,20,60));

            boolean survived = !gs.sank;
            int alive = gs.aliveCount();

            // Title
            JLabel title;
            if (!survived) {
                title = new JLabel("The Titanic Has Sunk", SwingConstants.CENTER);
                title.setForeground(C_RED);
            } else {
                title = new JLabel("New York City — April 17, 1912", SwingConstants.CENTER);
                title.setForeground(C_GOLD);
            }
            title.setFont(new Font("Serif",Font.BOLD,32));
            title.setAlignmentX(CENTER_ALIGNMENT);
            center.add(title);
            center.add(Box.createVerticalStrut(15));

            // Outcome narrative
            String narrative = buildNarrative(survived, alive);
            JLabel narLabel = new JLabel("<html><div style='text-align:center;width:580px;font-size:14pt;font-family:Serif;color:#e0d8b0'>"+narrative+"</div></html>");
            narLabel.setAlignmentX(CENTER_ALIGNMENT);
            center.add(narLabel);
            center.add(Box.createVerticalStrut(20));

            // Score / stats
            JPanel statsPanel = buildStatsPanel(survived, alive);
            center.add(statsPanel);
            center.add(Box.createVerticalStrut(20));

            // Historical note
            JLabel histNote = new JLabel("<html><div style='text-align:center;width:580px;font-size:11pt;font-family:Serif;font-style:italic;color:#9090a0'>"
                + "Historical note: On April 15, 1912, the real RMS Titanic sank after striking an iceberg. "
                + "Of the 2,224 people aboard, 1,517 perished — mostly due to a shortage of lifeboats. "
                + "Her wreck was discovered in 1985 at a depth of 12,500 feet."
                + "</div></html>");
            histNote.setAlignmentX(CENTER_ALIGNMENT);
            center.add(histNote);
            center.add(Box.createVerticalStrut(15));

            // Buttons
            JPanel btnRow = new JPanel(new FlowLayout());
            btnRow.setOpaque(false);
            JButton playAgainBtn = styledBtn("Play Again", new Color(40,80,40));
            playAgainBtn.setFont(new Font("Serif",Font.BOLD,16));
            playAgainBtn.addActionListener(e -> goTo(new TitlePanel()));
            JButton quitBtn = styledBtn("Quit", new Color(80,30,30));
            quitBtn.setFont(new Font("Serif",Font.BOLD,16));
            quitBtn.addActionListener(e -> System.exit(0));
            btnRow.add(playAgainBtn); btnRow.add(Box.createHorizontalStrut(20)); btnRow.add(quitBtn);
            btnRow.setOpaque(false);
            center.add(btnRow);

            JScrollPane scroll = new JScrollPane(center);
            scroll.setOpaque(false);
            scroll.getViewport().setOpaque(false);
            scroll.setBorder(null);
            scroll.getVerticalScrollBar().setUnitIncrement(16);
            add(scroll, BorderLayout.CENTER);
        }

        String buildNarrative(boolean survived, int alive) {
            if (survived) {
                if (alive == 5) return "Against all odds, the Titanic navigated safely through the iceberg field. Your entire party "+
                    "arrived safely in New York, healthy and in good spirits. Crowds cheered as the great ship docked.";
                else if (alive >= 3) return "Your party made it through Iceberg Alley, though the voyage claimed some lives. " +
                    alive+" of your companions stepped off the gangway onto American soil.";
                else return "Only "+alive+" of your party survived the crossing. The voyage was harrowing, but at last you arrived in New York.";
            } else {
                int boats = gs.lifeboats;
                int survivors = Math.min(alive, boats);
                if (survivors == 0)
                    return "The Titanic sank into the North Atlantic. With no lifeboat seats available, "+
                        "all members of your party perished in the freezing waters.";
                else if (survivors == alive)
                    return "The Titanic struck an iceberg and sank in two hours and forty minutes. "+
                        "Thanks to your lifeboat preparations, all "+alive+" surviving passengers secured seats. "+
                        "They were rescued by the RMS Carpathia at dawn.";
                else
                    return "The Titanic struck an iceberg and sank. In the chaos, only "+survivors+" of your "+alive+
                        " surviving passengers found lifeboat seats. They were rescued by the Carpathia. "+
                        (alive-survivors)+" soul"+(alive-survivors>1?"s":"")+" were lost to the sea.";
            }
        }

        JPanel buildStatsPanel(boolean survived, int alive) {
            JPanel p = new JPanel(new GridLayout(0,2,15,4));
            p.setBackground(C_PANEL);
            p.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(C_GOLD,1),
                BorderFactory.createEmptyBorder(12,20,12,20)));
            p.setMaximumSize(new Dimension(500,300));
            p.setAlignmentX(CENTER_ALIGNMENT);

            addStat(p,"Voyage Class:",     classStr(gs.shipClass));
            addStat(p,"Days at Sea:",      String.valueOf(gs.dayNum));
            addStat(p,"Passengers Alive:", alive+" / 5");
            addStat(p,"Iceberg Hits:",     String.valueOf(gs.icebergHits));
            addStat(p,"Food Remaining:",   gs.food+" lbs");
            addStat(p,"Coal Remaining:",   gs.coal+" tons");
            addStat(p,"Medicine Left:",    gs.medicine+" doses");
            addStat(p,"Lifeboat Seats:",   gs.lifeboats+" seats");
            addStat(p,"Outcome:", survived ? "SAFE ARRIVAL" : "SUNK");

            return p;
        }

        void addStat(JPanel p, String key, String val) {
            JLabel k = new JLabel(key); k.setFont(new Font("Serif",Font.BOLD,13)); k.setForeground(C_DIM);
            JLabel v = new JLabel(val); v.setFont(new Font("Serif",Font.PLAIN,13)); v.setForeground(C_CREAM);
            p.add(k); p.add(v);
        }

        String classStr(int c) {
            return c==1?"First Class":c==2?"Second Class":"Third Class (Steerage)";
        }
    }
}
