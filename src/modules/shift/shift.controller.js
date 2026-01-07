

import {
  createShiftService,
  getAllShiftsService,
  getShiftByIdService,
  updateShiftService,
  deleteShiftService,
  getShiftByShiftIdService,
  getShiftByStaffIdService
} from "./shift.service.js";

export const createShift = async (req, res) => {
  try {
    const createdById = req.user?.id || 7;

    let {
      staffIds,
      branchId = null,        // ✅ OPTIONAL NOW
      shiftDate,
      startTime,
      endTime,
      shiftType,
      description
    } = req.body;
    

    /* REQUIRED VALIDATIONS (branchId REMOVED) */
    if (!staffIds || !shiftDate || !startTime || !endTime || !shiftType) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields"
      });
    }


    /* STAFF IDS VALIDATION */
    let staffIdArray = [];
    if (Array.isArray(staffIds)) {
      staffIdArray = staffIds;
    } else if (staffIds) {
      // Handle comma-separated string or single value
      staffIdArray = String(staffIds).split(',').map(id => id.trim());
    }

    const createdShifts = [];

    // Create a shift for each staff member individually
    for (const singleStaffId of staffIdArray) {
      const shift = await createShiftService({
        staffIds: singleStaffId, // Store single ID per record
        branchId,
        shiftDate,
        startTime,
        endTime,
        shiftType,
        description,
        createdById
      });
      createdShifts.push(shift);
    }

    return res.status(201).json({
      success: true,
      message: "Shifts created successfully!",
      data: createdShifts
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllShifts = async (req, res) => {
  try {
    const adminId = Number(req.params.adminId);

    console.log("ADMIN ID:", adminId);

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const shifts = await getAllShiftsService(adminId);

    return res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts,
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




export const getShiftByStaffId = async (req, res, next) => {
  try {
    const { staffId } = req.params;

    const shift = await getShiftByStaffIdService(staffId);

    return res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
};


export const getShiftByShiftId = async (req, res, next) => {
  try {
    const { shiftId } = req.params;

    const shift = await getShiftByShiftIdService(shiftId);

    return res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
};


export const getShiftById = async (req, res) => {
  const shift = await getShiftByIdService(req.params.id);
  return res.json({ success: true, data: shift });
};

export const updateShift = async (req, res) => {
  const updated = await updateShiftService(req.params.id, req.body);
  return res.json({ success: true, message: "Shift updated", data: updated });
};

export const deleteShift = async (req, res) => {
  await deleteShiftService(req.params.id);
  return res.json({ success: true, message: "Shift deleted" });
};

// approve / reject only
export const updateShiftStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status required" });
    }

    const updated = await updateShiftService(id, { status });
    return res.json({
      success: true,
      message: `Shift ${status} successfully`,
      data: updated
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};