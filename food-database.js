// Food Database for UC (Ulcerative Colitis) Food Tracker
// Each food includes: calories, protein, anti-inflammatory status, UC safety, and Ayurveda properties

const FOOD_DATABASE = [
    // ========== PROTEINS ==========
    {
        name: "Chicken Breast (4 oz, grilled)",
        calories: 165,
        protein: 31,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "protein"
    },
    {
        name: "Salmon (4 oz, baked)",
        calories: 234,
        protein: 25,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein",
        notes: "Excellent omega-3 source, highly anti-inflammatory"
    },
    {
        name: "Eggs (2 large, scrambled)",
        calories: 182,
        protein: 12,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "protein"
    },
    {
        name: "Turkey Breast (4 oz)",
        calories: 153,
        protein: 34,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein"
    },
    {
        name: "Cod (4 oz, baked)",
        calories: 93,
        protein: 20,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein"
    },
    {
        name: "Tilapia (4 oz)",
        calories: 110,
        protein: 23,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein"
    },
    {
        name: "Shrimp (4 oz)",
        calories: 100,
        protein: 24,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "pitta-aggravating",
        category: "protein",
        notes: "May trigger some people"
    },
    {
        name: "Ground Turkey (4 oz, 93% lean)",
        calories: 170,
        protein: 21,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "protein"
    },
    {
        name: "Bone Broth (1 cup)",
        calories: 40,
        protein: 10,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein",
        notes: "Excellent for gut healing"
    },
    {
        name: "Greek Yogurt (1 cup, plain)",
        calories: 100,
        protein: 17,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "protein",
        notes: "Probiotics helpful, but dairy may trigger some"
    },
    {
        name: "Tofu (4 oz, firm)",
        calories: 94,
        protein: 10,
        antiInflammatory: "yes",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "protein",
        notes: "Soy may be a trigger for some"
    },
    {
        name: "Egg Whites (4 large)",
        calories: 68,
        protein: 14,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "protein"
    },

    // ========== GRAINS & STARCHES ==========
    {
        name: "White Rice (1 cup cooked)",
        calories: 206,
        protein: 4,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "grain",
        notes: "Easy to digest, good during flares"
    },
    {
        name: "Oatmeal (1 cup cooked)",
        calories: 158,
        protein: 6,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "grain",
        notes: "Well-cooked oats are soothing"
    },
    {
        name: "Sweet Potato (1 medium, baked)",
        calories: 103,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "grain"
    },
    {
        name: "Quinoa (1 cup cooked)",
        calories: 222,
        protein: 8,
        antiInflammatory: "yes",
        ucSafe: "caution",
        ayurveda: "tridoshic",
        category: "grain",
        notes: "High fiber - may need to limit during flares"
    },
    {
        name: "White Bread (1 slice)",
        calories: 79,
        protein: 3,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "vata-pacifying",
        category: "grain"
    },
    {
        name: "Rice Noodles (1 cup cooked)",
        calories: 192,
        protein: 2,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "grain"
    },
    {
        name: "Cream of Rice (1 cup cooked)",
        calories: 127,
        protein: 2,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "grain",
        notes: "Excellent during flares"
    },
    {
        name: "Mashed Potatoes (1 cup)",
        calories: 210,
        protein: 4,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "vata-pacifying",
        category: "grain"
    },
    {
        name: "Brown Rice (1 cup cooked)",
        calories: 216,
        protein: 5,
        antiInflammatory: "yes",
        ucSafe: "caution",
        ayurveda: "tridoshic",
        category: "grain",
        notes: "Higher fiber - avoid during flares"
    },

    // ========== VEGETABLES (COOKED) ==========
    {
        name: "Cooked Carrots (1 cup)",
        calories: 54,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable"
    },
    {
        name: "Zucchini (1 cup cooked)",
        calories: 27,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable"
    },
    {
        name: "Butternut Squash (1 cup cooked)",
        calories: 82,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable"
    },
    {
        name: "Spinach (1 cup cooked)",
        calories: 41,
        protein: 5,
        antiInflammatory: "yes",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "vegetable",
        notes: "High oxalate - cook well, limit during flares"
    },
    {
        name: "Cucumber (1 cup, peeled)",
        calories: 16,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable",
        notes: "Very cooling - excellent for Pitta"
    },
    {
        name: "Green Beans (1 cup cooked)",
        calories: 44,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "vegetable"
    },
    {
        name: "Asparagus (1 cup cooked)",
        calories: 40,
        protein: 4,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable"
    },
    {
        name: "Pumpkin (1 cup cooked)",
        calories: 49,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "vegetable"
    },
    {
        name: "Broccoli (1 cup cooked)",
        calories: 55,
        protein: 4,
        antiInflammatory: "yes",
        ucSafe: "avoid",
        ayurveda: "vata-aggravating",
        category: "vegetable",
        notes: "Cruciferous - often causes gas, avoid during flares"
    },
    {
        name: "Cauliflower (1 cup cooked)",
        calories: 29,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "avoid",
        ayurveda: "vata-aggravating",
        category: "vegetable",
        notes: "Cruciferous - often causes gas"
    },

    // ========== FRUITS ==========
    {
        name: "Banana (1 medium, ripe)",
        calories: 105,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "Very well tolerated, soothing"
    },
    {
        name: "Applesauce (1 cup, unsweetened)",
        calories: 102,
        protein: 0,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "Easy to digest, BRAT diet staple"
    },
    {
        name: "Blueberries (1 cup)",
        calories: 84,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "High in antioxidants"
    },
    {
        name: "Papaya (1 cup)",
        calories: 62,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "Contains digestive enzymes"
    },
    {
        name: "Cantaloupe (1 cup)",
        calories: 54,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit"
    },
    {
        name: "Avocado (1/2 medium)",
        calories: 160,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "Healthy fats, very anti-inflammatory"
    },
    {
        name: "Mango (1 cup)",
        calories: 99,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit",
        notes: "Sweet and cooling"
    },
    {
        name: "Peaches (1 medium, peeled)",
        calories: 58,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit"
    },
    {
        name: "Orange (1 medium)",
        calories: 62,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "fruit",
        notes: "Citrus can be acidic and trigger flares"
    },
    {
        name: "Grapes (1 cup)",
        calories: 62,
        protein: 1,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fruit"
    },

    // ========== FATS & OILS ==========
    {
        name: "Ghee (1 tbsp)",
        calories: 112,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fat",
        notes: "Ayurveda gold - healing for gut lining"
    },
    {
        name: "Olive Oil (1 tbsp)",
        calories: 119,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fat"
    },
    {
        name: "Coconut Oil (1 tbsp)",
        calories: 121,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "fat",
        notes: "Cooling and antimicrobial"
    },
    {
        name: "Almond Butter (1 tbsp)",
        calories: 98,
        protein: 3,
        antiInflammatory: "yes",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "fat",
        notes: "Nut butters may be okay if smooth"
    },
    {
        name: "Butter (1 tbsp)",
        calories: 102,
        protein: 0,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "fat",
        notes: "Dairy - ghee is preferred"
    },

    // ========== BEVERAGES ==========
    {
        name: "Coconut Water (1 cup)",
        calories: 46,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "beverage",
        notes: "Very hydrating and cooling"
    },
    {
        name: "Ginger Tea (1 cup)",
        calories: 2,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "beverage",
        notes: "Digestive aid, use mild for UC"
    },
    {
        name: "Chamomile Tea (1 cup)",
        calories: 2,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "beverage",
        notes: "Calming and anti-inflammatory"
    },
    {
        name: "Aloe Vera Juice (2 oz)",
        calories: 8,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "beverage",
        notes: "Ayurveda remedy - very cooling and healing"
    },
    {
        name: "Peppermint Tea (1 cup)",
        calories: 2,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "beverage"
    },
    {
        name: "Coffee (1 cup, black)",
        calories: 2,
        protein: 0,
        antiInflammatory: "neutral",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "beverage",
        notes: "Stimulant - can trigger urgency"
    },

    // ========== SPICES & CONDIMENTS ==========
    {
        name: "Turmeric (1 tsp)",
        calories: 8,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "spice",
        notes: "Powerful anti-inflammatory - use with ghee and black pepper"
    },
    {
        name: "Ginger (1 tsp, fresh grated)",
        calories: 2,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "spice",
        notes: "Digestive aid"
    },
    {
        name: "Cumin (1 tsp)",
        calories: 8,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "tridoshic",
        category: "spice",
        notes: "Digestive, cooling"
    },
    {
        name: "Coriander (1 tsp)",
        calories: 5,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "spice",
        notes: "Very cooling - excellent for Pitta"
    },
    {
        name: "Fennel Seeds (1 tsp)",
        calories: 7,
        protein: 0,
        antiInflammatory: "yes",
        ucSafe: "safe",
        ayurveda: "pitta-pacifying",
        category: "spice",
        notes: "Digestive, reduces bloating"
    },
    {
        name: "Chili Powder (1 tsp)",
        calories: 6,
        protein: 0,
        antiInflammatory: "no",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "spice",
        notes: "Avoid - aggravates Pitta and irritates gut"
    },

    // ========== SNACKS ==========
    {
        name: "Rice Cakes (2 cakes)",
        calories: 70,
        protein: 1,
        antiInflammatory: "neutral",
        ucSafe: "safe",
        ayurveda: "vata-pacifying",
        category: "snack"
    },
    {
        name: "Protein Shake (whey, 1 scoop)",
        calories: 120,
        protein: 24,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "tridoshic",
        category: "snack",
        notes: "Dairy-based - try lactose-free if sensitive"
    },
    {
        name: "Protein Bar (average)",
        calories: 200,
        protein: 20,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "vata-aggravating",
        category: "snack",
        notes: "Check ingredients for triggers"
    },
    {
        name: "Cottage Cheese (1/2 cup)",
        calories: 110,
        protein: 14,
        antiInflammatory: "neutral",
        ucSafe: "caution",
        ayurveda: "pitta-pacifying",
        category: "snack",
        notes: "Dairy - may be tolerated by some"
    },

    // ========== FOODS TO AVOID ==========
    {
        name: "Fried Chicken (4 oz)",
        calories: 320,
        protein: 24,
        antiInflammatory: "no",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "protein",
        notes: "Fried foods are inflammatory"
    },
    {
        name: "Hot Wings (6 pieces)",
        calories: 430,
        protein: 30,
        antiInflammatory: "no",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "protein",
        notes: "Spicy and fried - double trigger"
    },
    {
        name: "Popcorn (3 cups)",
        calories: 93,
        protein: 3,
        antiInflammatory: "neutral",
        ucSafe: "avoid",
        ayurveda: "vata-aggravating",
        category: "snack",
        notes: "Hard to digest husks"
    },
    {
        name: "Raw Salad (mixed greens, 2 cups)",
        calories: 20,
        protein: 2,
        antiInflammatory: "yes",
        ucSafe: "avoid",
        ayurveda: "vata-aggravating",
        category: "vegetable",
        notes: "Raw vegetables hard to digest during flares"
    },
    {
        name: "Beer (12 oz)",
        calories: 153,
        protein: 2,
        antiInflammatory: "no",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "beverage",
        notes: "Alcohol irritates gut lining"
    },
    {
        name: "Red Wine (5 oz)",
        calories: 125,
        protein: 0,
        antiInflammatory: "no",
        ucSafe: "avoid",
        ayurveda: "pitta-aggravating",
        category: "beverage",
        notes: "Alcohol irritates gut lining"
    }
];

// Daily goals for 5'2" 150lb person targeting fat loss
const DAILY_GOALS = {
    calories: 1400,
    protein: 120,
    notes: "Based on moderate deficit for sustainable fat loss. Adjust based on activity level and how you feel."
};
