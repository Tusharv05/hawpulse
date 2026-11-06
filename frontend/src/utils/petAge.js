/**
 * Precise Pet Age Utilities
 *
 * Avoids floating-point millisecond approximations (e.g. 365.25 or 30.4375)
 * which cause rounding errors like 5 years becoming 4.999 and flooring to 4.
 */

/**
 * Calculates a clean YYYY-MM-DD birth date from age value and unit.
 * @param {number|string} ageValue - Numeric age (e.g. 5, 2, 0.5)
 * @param {'years'|'months'} unit - 'years' or 'months'
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function calculateBirthDateFromAge(ageValue, unit = 'years') {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const todayDay = now.getDate();

  if (unit === 'months') {
    const months = Math.max(1, parseInt(ageValue, 10) || 1);
    const targetDate = new Date(todayYear, todayMonth - months, todayDay);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Years (can be integer 5 or float 1.5)
  const yearsFloat = Math.max(0.1, parseFloat(ageValue) || 1);
  const isWholeYear = Math.abs(yearsFloat - Math.round(yearsFloat)) < 0.05;

  if (isWholeYear) {
    const wholeYears = Math.round(yearsFloat);
    const targetDate = new Date(todayYear - wholeYears, todayMonth, todayDay);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fractional years, e.g. 1.5 years -> 18 months
  const totalMonths = Math.max(1, Math.round(yearsFloat * 12));
  const targetDate = new Date(todayYear, todayMonth - totalMonths, todayDay);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a birthDate string or Date object into structured age details.
 * @param {string|Date} birthDate - e.g. "2021-10-26" or Date object
 * @returns {{ display: string, value: number, unit: 'years'|'months'|'weeks'|'days' }}
 */
export function getPetAgeDetails(birthDate) {
  if (!birthDate) {
    return { display: '1 yr', value: 1, unit: 'years' };
  }

  let bYear, bMonth, bDay;
  if (typeof birthDate === 'string') {
    const cleanDateStr = birthDate.split('T')[0];
    const parts = cleanDateStr.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      bYear = parts[0];
      bMonth = parts[1]; // 1-12
      bDay = parts[2];
    } else {
      const d = new Date(birthDate);
      bYear = d.getFullYear();
      bMonth = d.getMonth() + 1;
      bDay = d.getDate();
    }
  } else if (birthDate instanceof Date) {
    bYear = birthDate.getFullYear();
    bMonth = birthDate.getMonth() + 1;
    bDay = birthDate.getDate();
  } else {
    return { display: '1 yr', value: 1, unit: 'years' };
  }

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1-12
  const nowDay = now.getDate();

  // Elapsed calendar months:
  let totalMonths = (nowYear - bYear) * 12 + (nowMonth - bMonth);

  // If today's day of month is before birth day by more than 2 days, subtract 1 month
  // (2-day grace window prevents timezone / leap day edge-cases from dropping a month/year)
  if (nowDay < bDay - 2) {
    totalMonths -= 1;
  }
  if (totalMonths < 0) totalMonths = 0;

  // Very young: under 1 month
  if (totalMonths < 1) {
    const birthObj = new Date(bYear, bMonth - 1, bDay);
    const diffMs = Math.max(0, now.getTime() - birthObj.getTime());
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (diffDays <= 7) {
      const days = Math.max(1, diffDays);
      return { display: `${days} day${days === 1 ? '' : 's'}`, value: days, unit: 'days' };
    }
    const weeks = Math.round(diffDays / 7);
    return { display: `${weeks} wk${weeks === 1 ? '' : 's'}`, value: weeks, unit: 'weeks' };
  }

  // Under 12 months -> Display in months
  if (totalMonths < 12) {
    return {
      display: `${totalMonths} mo${totalMonths === 1 ? '' : 's'}`,
      value: totalMonths,
      unit: 'months'
    };
  }

  // 12 months and older -> Display in years
  const fullYears = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  // If 2 years or older: round to nearest year (or if within 1 month of anniversary)
  if (fullYears >= 2) {
    const displayYears = remainingMonths >= 11 ? fullYears + 1 : fullYears;
    return {
      display: `${displayYears} yrs`,
      value: displayYears,
      unit: 'years'
    };
  }

  // Between 1 and 2 years (12 - 23 months)
  if (remainingMonths <= 1) {
    return { display: '1 yr', value: 1, unit: 'years' };
  }
  if (remainingMonths >= 11) {
    return { display: '2 yrs', value: 2, unit: 'years' };
  }

  // Fractional year like 1.5 yrs
  const decimalYears = Math.round((totalMonths / 12) * 10) / 10;
  return {
    display: decimalYears % 1 === 0 ? `${Math.floor(decimalYears)} yr` : `${decimalYears} yrs`,
    value: decimalYears,
    unit: 'years'
  };
}

/**
 * Formats pet age for quick display tags (e.g. "5 yrs", "5 mos", "1 yr").
 * @param {string|Date} birthDate
 * @returns {string}
 */
export function formatPetAge(birthDate) {
  return getPetAgeDetails(birthDate).display;
}
