require('dotenv').config();
const { query, pool } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Starting seed...\n');

  // ── 1. INSTITUTIONS ─────────────────────────────────────────
  console.log('📍 Seeding institutions...');
  const { rows: institutions } = await query(`
    INSERT INTO institutions (name, short_name, type, state, city, is_verified, is_active)
    VALUES
      ('University of Maiduguri',  'UNIMAID', 'university',   'Borno', 'Maiduguri', TRUE, TRUE),
      ('Ramat Polytechnic',        'RAMAT',   'polytechnic',  'Borno', 'Maiduguri', TRUE, TRUE),
      ('Borno State University',   'BOSU',    'university',   'Borno', 'Maiduguri', TRUE, TRUE)
    ON CONFLICT DO NOTHING
    RETURNING id, name, short_name, type
  `);
  console.log(`   ✅ ${institutions.length} institutions seeded`);

  // Helper lookups
  const getInstitution = (short) => institutions.find(i => i.short_name === short);
  const unimaid = getInstitution('UNIMAID');
  const ramat   = getInstitution('RAMAT');
  const bosu    = getInstitution('BOSU');

  if (!unimaid || !ramat) {
    // Already seeded — fetch them
    const all = await query(`SELECT id, name, short_name, type FROM institutions`);
    institutions.push(...all.rows);
  }

  const uni   = institutions.find(i => i.short_name === 'UNIMAID') || (await query(`SELECT id FROM institutions WHERE short_name='UNIMAID'`)).rows[0];
  const poly  = institutions.find(i => i.short_name === 'RAMAT')   || (await query(`SELECT id FROM institutions WHERE short_name='RAMAT'`)).rows[0];
  const bosu2 = institutions.find(i => i.short_name === 'BOSU')    || (await query(`SELECT id FROM institutions WHERE short_name='BOSU'`)).rows[0];

  // ── 2. FACULTIES (University) ────────────────────────────────
  console.log('\n🎓 Seeding faculties (UNIMAID)...');
  const { rows: faculties } = await query(`
    INSERT INTO faculties (institution_id, name, code)
    VALUES
      ($1, 'Faculty of Engineering',             'ENG'),
      ($1, 'Faculty of Science',                 'SCI'),
      ($1, 'Faculty of Arts',                    'ART'),
      ($1, 'Faculty of Social Sciences',         'SSC'),
      ($1, 'Faculty of Medicine',                'MED'),
      ($1, 'Faculty of Law',                     'LAW'),
      ($1, 'Faculty of Education',               'EDU'),
      ($1, 'Faculty of Management Sciences',     'MGT')
    ON CONFLICT (institution_id, code) DO NOTHING
    RETURNING id, name, code
  `, [uni.id]);
  console.log(`   ✅ ${faculties.length} faculties seeded`);

  const allFaculties = faculties.length
    ? faculties
    : (await query(`SELECT id, name, code FROM faculties WHERE institution_id = $1`, [uni.id])).rows;
  const getFaculty = (code) => allFaculties.find(f => f.code === code);

  // ── 3. SCHOOLS (Polytechnic) ─────────────────────────────────
  console.log('\n🏫 Seeding schools (RAMAT)...');
  const { rows: schools } = await query(`
    INSERT INTO schools (institution_id, name, code)
    VALUES
      ($1, 'School of Engineering',              'SENG'),
      ($1, 'School of Business Studies',         'SBUS'),
      ($1, 'School of Environmental Studies',    'SENV'),
      ($1, 'School of Information Technology',   'SITS'),
      ($1, 'School of General Studies',          'SGEN')
    ON CONFLICT (institution_id, code) DO NOTHING
    RETURNING id, name, code
  `, [poly.id]);
  console.log(`   ✅ ${schools.length} schools seeded`);

  const allSchools = schools.length
    ? schools
    : (await query(`SELECT id, name, code FROM schools WHERE institution_id = $1`, [poly.id])).rows;
  const getSchool = (code) => allSchools.find(s => s.code === code);

  // ── 4. DEPARTMENTS ───────────────────────────────────────────
  console.log('\n🏢 Seeding departments...');

  // University departments (under faculties)
  const uniDepts = await query(`
    INSERT INTO departments (faculty_id, name, code)
    VALUES
      ($1, 'Computer Engineering',           'CPE'),
      ($1, 'Electrical Engineering',         'EEE'),
      ($1, 'Mechanical Engineering',         'MEE'),
      ($1, 'Civil Engineering',              'CVE'),
      ($2, 'Computer Science',               'CSC'),
      ($2, 'Mathematics',                    'MTH'),
      ($2, 'Physics',                        'PHY'),
      ($2, 'Chemistry',                      'CHM'),
      ($3, 'English & Literary Studies',     'ELS'),
      ($3, 'History & International Studies','HIS'),
      ($4, 'Economics',                      'ECO'),
      ($4, 'Sociology',                      'SOC'),
      ($5, 'Medicine & Surgery',             'MBS'),
      ($5, 'Nursing Science',                'NRS'),
      ($6, 'Law',                            'LAW'),
      ($7, 'Education & Computer Science',   'ECS'),
      ($8, 'Business Administration',        'BAD'),
      ($8, 'Accounting',                     'ACC')
    ON CONFLICT DO NOTHING
    RETURNING id, name, code
  `, [
    getFaculty('ENG').id,
    getFaculty('SCI').id,
    getFaculty('ART').id,
    getFaculty('SSC').id,
    getFaculty('MED').id,
    getFaculty('LAW').id,
    getFaculty('EDU').id,
    getFaculty('MGT').id
  ]);
  console.log(`   ✅ ${uniDepts.rows.length} university departments seeded`);

  // Polytechnic departments (under schools)
  const polyDepts = await query(`
    INSERT INTO departments (school_id, name, code)
    VALUES
      ($1, 'Computer Engineering Technology',  'CET'),
      ($1, 'Electrical Engineering Technology','EET'),
      ($1, 'Mechanical Engineering Technology','MET'),
      ($2, 'Business Administration',          'BAD'),
      ($2, 'Accountancy',                      'ACT'),
      ($2, 'Marketing',                        'MKT'),
      ($3, 'Urban & Regional Planning',        'URP'),
      ($3, 'Building Technology',              'BLT'),
      ($4, 'Computer Science',                 'CSC'),
      ($4, 'Information Technology',           'IFT'),
      ($5, 'General Studies',                  'GST')
    ON CONFLICT DO NOTHING
    RETURNING id, name, code
  `, [
    getSchool('SENG').id,
    getSchool('SBUS').id,
    getSchool('SENV').id,
    getSchool('SITS').id,
    getSchool('SGEN').id
  ]);
  console.log(`   ✅ ${polyDepts.rows.length} polytechnic departments seeded`);

  // ── 5. FETCH ALL DEPARTMENTS for course seeding ──────────────
  const { rows: allDepts } = await query(`
    SELECT d.id, d.code, d.faculty_id, d.school_id,
           f.institution_id AS uni_institution_id,
           s.institution_id AS poly_institution_id
    FROM departments d
    LEFT JOIN faculties f ON f.id = d.faculty_id
    LEFT JOIN schools   s ON s.id = d.school_id
  `);
  const getDept = (code, type) => allDepts.find(d =>
    d.code === code && (type === 'uni' ? d.faculty_id !== null : d.school_id !== null)
  );

  // ── 6. COURSES ───────────────────────────────────────────────
  console.log('\n📚 Seeding courses...');

  // ── University Courses: Computer Engineering ─────────────────
  const cpeDept = getDept('CPE', 'uni');
  if (cpeDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'Introduction to Computing',         'CPE101', 2, '100', 'university', 'first'),
        ($1,'Engineering Mathematics I',         'CPE102', 3, '100', 'university', 'first'),
        ($1,'Engineering Mathematics II',        'CPE103', 3, '100', 'university', 'second'),
        ($1,'Logic Design',                      'CPE104', 2, '100', 'university', 'second'),
        ($1,'Data Structures & Algorithms',      'CPE201', 3, '200', 'university', 'first'),
        ($1,'Computer Architecture',             'CPE202', 3, '200', 'university', 'first'),
        ($1,'Object Oriented Programming',       'CPE203', 3, '200', 'university', 'second'),
        ($1,'Discrete Mathematics',              'CPE204', 2, '200', 'university', 'second'),
        ($1,'Computer Networks',                 'CPE301', 3, '300', 'university', 'first'),
        ($1,'Operating Systems',                 'CPE302', 3, '300', 'university', 'first'),
        ($1,'Database Systems',                  'CPE303', 3, '300', 'university', 'second'),
        ($1,'Software Engineering',              'CPE304', 3, '300', 'university', 'second'),
        ($1,'Microprocessors & Interfacing',     'CPE401', 3, '400', 'university', 'first'),
        ($1,'Artificial Intelligence',           'CPE402', 3, '400', 'university', 'first'),
        ($1,'Computer Graphics',                 'CPE403', 2, '400', 'university', 'second'),
        ($1,'Final Year Project I',              'CPE501', 6, '500', 'university', 'first'),
        ($1,'Final Year Project II',             'CPE502', 6, '500', 'university', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [cpeDept.id]);
    console.log('   ✅ CPE (Computer Engineering) courses seeded');
  }

  // ── University Courses: Computer Science ─────────────────────
  const cscDept = getDept('CSC', 'uni');
  if (cscDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'Introduction to Computer Science',  'CSC101', 2, '100', 'university', 'first'),
        ($1,'Programming Fundamentals',          'CSC102', 3, '100', 'university', 'first'),
        ($1,'Web Technologies',                  'CSC201', 3, '200', 'university', 'first'),
        ($1,'Data Structures',                   'CSC202', 3, '200', 'university', 'second'),
        ($1,'Database Management Systems',       'CSC301', 3, '300', 'university', 'first'),
        ($1,'Software Engineering',              'CSC302', 3, '300', 'university', 'second'),
        ($1,'Networks & Security',               'CSC401', 3, '400', 'university', 'first'),
        ($1,'Machine Learning Fundamentals',     'CSC402', 3, '400', 'university', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [cscDept.id]);
    console.log('   ✅ CSC (Computer Science) courses seeded');
  }

  // ── University Courses: Electrical Engineering ───────────────
  const eeeDept = getDept('EEE', 'uni');
  if (eeeDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'Circuit Theory I',                  'EEE101', 3, '100', 'university', 'first'),
        ($1,'Circuit Theory II',                 'EEE102', 3, '100', 'university', 'second'),
        ($1,'Electromagnetic Fields',            'EEE201', 3, '200', 'university', 'first'),
        ($1,'Electronic Devices & Circuits',     'EEE202', 3, '200', 'university', 'second'),
        ($1,'Power Systems I',                   'EEE301', 3, '300', 'university', 'first'),
        ($1,'Control Systems',                   'EEE302', 3, '300', 'university', 'second'),
        ($1,'Power Electronics',                 'EEE401', 3, '400', 'university', 'first'),
        ($1,'Renewable Energy Systems',          'EEE402', 3, '400', 'university', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [eeeDept.id]);
    console.log('   ✅ EEE (Electrical Engineering) courses seeded');
  }

  // ── Polytechnic Courses: Computer Engineering Technology ─────
  const cetDept = getDept('CET', 'poly');
  if (cetDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'Introduction to Computer Engineering', 'CET101', 2, 'ND1', 'polytechnic', 'first'),
        ($1,'Digital Electronics',                  'CET102', 3, 'ND1', 'polytechnic', 'first'),
        ($1,'Computer Programming I',               'CET103', 3, 'ND1', 'polytechnic', 'second'),
        ($1,'Electronic Circuits',                  'CET104', 3, 'ND1', 'polytechnic', 'second'),
        ($1,'Microprocessor Systems',               'CET201', 3, 'ND2', 'polytechnic', 'first'),
        ($1,'Computer Programming II',              'CET202', 3, 'ND2', 'polytechnic', 'first'),
        ($1,'Data Communications',                  'CET203', 2, 'ND2', 'polytechnic', 'second'),
        ($1,'ND Project',                           'CET204', 4, 'ND2', 'polytechnic', 'second'),
        ($1,'Advanced Microprocessors',             'CET301', 3, 'HND1','polytechnic', 'first'),
        ($1,'Network Administration',               'CET302', 3, 'HND1','polytechnic', 'first'),
        ($1,'Embedded Systems',                     'CET303', 3, 'HND1','polytechnic', 'second'),
        ($1,'Industrial Automation',                'CET401', 3, 'HND2','polytechnic', 'first'),
        ($1,'HND Project',                          'CET402', 6, 'HND2','polytechnic', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [cetDept.id]);
    console.log('   ✅ CET (Computer Engineering Technology) courses seeded');
  }

  // ── Polytechnic Courses: Information Technology ──────────────
  const iftDept = getDept('IFT', 'poly');
  if (iftDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'IT Fundamentals',                   'IFT101', 2, 'ND1', 'polytechnic', 'first'),
        ($1,'Web Design Basics',                 'IFT102', 3, 'ND1', 'polytechnic', 'second'),
        ($1,'Database Fundamentals',             'IFT201', 3, 'ND2', 'polytechnic', 'first'),
        ($1,'Systems Analysis & Design',         'IFT202', 3, 'ND2', 'polytechnic', 'second'),
        ($1,'Network Fundamentals',              'IFT301', 3, 'HND1','polytechnic', 'first'),
        ($1,'Web Application Development',       'IFT302', 3, 'HND1','polytechnic', 'second'),
        ($1,'Cloud Computing',                   'IFT401', 3, 'HND2','polytechnic', 'first'),
        ($1,'IT Project Management',             'IFT402', 3, 'HND2','polytechnic', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [iftDept.id]);
    console.log('   ✅ IFT (Information Technology) courses seeded');
  }

  // ── Polytechnic Courses: Accountancy ─────────────────────────
  const actDept = getDept('ACT', 'poly');
  if (actDept) {
    await query(`
      INSERT INTO courses (department_id, title, code, credit_units, level, level_type, semester)
      VALUES
        ($1,'Principles of Accounting I',        'ACT101', 3, 'ND1', 'polytechnic', 'first'),
        ($1,'Business Mathematics',              'ACT102', 2, 'ND1', 'polytechnic', 'first'),
        ($1,'Principles of Accounting II',       'ACT103', 3, 'ND1', 'polytechnic', 'second'),
        ($1,'Cost Accounting',                   'ACT201', 3, 'ND2', 'polytechnic', 'first'),
        ($1,'Financial Accounting',              'ACT202', 3, 'ND2', 'polytechnic', 'second'),
        ($1,'Auditing I',                        'ACT301', 3, 'HND1','polytechnic', 'first'),
        ($1,'Taxation',                          'ACT302', 3, 'HND1','polytechnic', 'second'),
        ($1,'Advanced Financial Accounting',     'ACT401', 3, 'HND2','polytechnic', 'first'),
        ($1,'HND Project',                       'ACT402', 6, 'HND2','polytechnic', 'second')
      ON CONFLICT (department_id, code) DO NOTHING
    `, [actDept.id]);
    console.log('   ✅ ACT (Accountancy) courses seeded');
  }

  // ── 7. ADMIN USER ────────────────────────────────────────────
  console.log('\n👤 Seeding admin user...');
  const passwordHash = await bcrypt.hash('Admin@kampus2025!', 12);
  const { rows: adminRows } = await query(`
    INSERT INTO users (full_name, email, phone, password_hash, role, is_verified)
    VALUES ('KampusLearn Admin', 'admin@kampuslearn.ng', '08000000000', $1, 'admin', TRUE)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role
  `, [passwordHash]);

  if (adminRows.length > 0) {
    // Give admin a free subscription
    await query(`
      INSERT INTO subscriptions (user_id, plan, status)
      VALUES ($1, 'free', 'active')
      ON CONFLICT DO NOTHING
    `, [adminRows[0].id]);
    console.log(`   ✅ Admin user created: admin@kampuslearn.ng`);
    console.log(`   🔑 Password: Admin@kampus2025!  (change after first login)`);
  } else {
    console.log('   ℹ️  Admin user already exists');
  }

  // ── 8. SUMMARY ───────────────────────────────────────────────
  console.log('\n📊 Seed Summary:');
  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM institutions)    AS institutions,
      (SELECT COUNT(*) FROM faculties)       AS faculties,
      (SELECT COUNT(*) FROM schools)         AS schools,
      (SELECT COUNT(*) FROM departments)     AS departments,
      (SELECT COUNT(*) FROM courses)         AS courses,
      (SELECT COUNT(*) FROM users)           AS users
  `);
  const c = counts.rows[0];
  console.log(`   Institutions : ${c.institutions}`);
  console.log(`   Faculties    : ${c.faculties}`);
  console.log(`   Schools      : ${c.schools}`);
  console.log(`   Departments  : ${c.departments}`);
  console.log(`   Courses      : ${c.courses}`);
  console.log(`   Users        : ${c.users}`);
  console.log('\n✅ Seed completed successfully!\n');
}

seed()
  .catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
