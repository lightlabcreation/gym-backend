import { pool } from "../../config/db.js";

// ----- CREATE DIET PLAN -----
export const createDietPlanService = async ({ title, notes, branchId, createdBy, meals }) => {
  if (!title) throw { status: 400, message: "Diet plan title is required" };
  if (!branchId) throw { status: 400, message: "Branch ID is required" };

  // Insert diet plan
  const [planResult] = await pool.query(
    "INSERT INTO dietplan (title, notes, branchId, createdBy) VALUES (?, ?, ?, ?)",
    [title, notes || "", branchId, createdBy || null]
  );
  const dietPlanId = planResult.insertId;

  // Insert meals if provided
  if (meals && meals.length) {
    const mealValues = meals.map(m => [dietPlanId, m.name, m.time, m.notes || ""]);
    await pool.query(
      "INSERT INTO dietmeal (dietPlanId, name, time, notes) VALUES ?",
      [mealValues]
    );
  }

  // Return diet plan with meals
  const [createdPlan] = await pool.query(
    "SELECT * FROM dietplan WHERE id = ?",
    [dietPlanId]
  );

  const [planMeals] = await pool.query(
    "SELECT * FROM dietmeal WHERE dietPlanId = ?",
    [dietPlanId]
  );

  return { ...createdPlan[0], meals: planMeals };
};

// ----- ASSIGN DIET PLAN TO MEMBER -----
export const assignDietPlanService = async (memberId, dietPlanId) => {
  // Check if assignment exists
  const [existing] = await pool.query(
    "SELECT * FROM dietplanassignment WHERE memberId = ? AND dietPlanId = ?",
    [memberId, dietPlanId]
  );
  if (existing.length) throw { status: 400, message: "Diet plan already assigned to member" };

  // Insert assignment
  const [result] = await pool.query(
    "INSERT INTO dietplanassignment (memberId, dietPlanId) VALUES (?, ?)",
    [memberId, dietPlanId]
  );

  // Return assigned plan with meals
  const [assignedPlan] = await pool.query(
    `SELECT d.*, m.id AS mealId, m.name AS mealName, m.time AS mealTime, m.notes AS mealNotes
     FROM dietplan d
     LEFT JOIN dietPlanMeal m ON d.id = m.dietPlanId
     WHERE d.id = ?`,
    [dietPlanId]
  );

  return assignedPlan;
};

// ----- GET MEMBER DIET PLANS -----
export const getMemberDietPlanService = async (memberId) => {
  const [assignments] = await pool.query(
    `SELECT a.id AS assignmentId, d.id AS dietPlanId, d.title, d.notes,
            m.id AS mealId, m.name AS mealName, m.time AS mealTime, m.notes AS mealNotes
     FROM dietplanassignment a
     JOIN dietPlan d ON a.dietPlanId = d.id
     LEFT JOIN dietmeal m ON d.id = m.dietPlanId
     WHERE a.memberId = ?
     ORDER BY a.id DESC`,
    [memberId]
  );

  // Format meals under diet plans
  const plans = {};
  assignments.forEach(a => {
    if (!plans[a.dietPlanId]) {
      plans[a.dietPlanId] = { id: a.dietPlanId, title: a.title, notes: a.notes, meals: [] };
    }
    if (a.mealId) {
      plans[a.dietPlanId].meals.push({
        id: a.mealId,
        name: a.mealName,
        time: a.mealTime,
        notes: a.mealNotes
      });
    }
  });

  return Object.values(plans);
};
