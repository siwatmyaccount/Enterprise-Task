document.addEventListener('DOMContentLoaded', () => {
    
    // ================= CONFIG & VARIABLES =================
    const DB_USERS_KEY = "app_users_v2";
    const DB_SESSION_KEY = "app_current_user";
    
    // โหลดข้อมูล User ทั้งหมด
    let allUsers = JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [{ username: "admin", password: "1234", email: "admin@company.com", joined: new Date().toLocaleDateString() }];
    
    let currentUser = null;
    let userTasks = [];
    let userProfileExt = {}; // เก็บข้อมูลเพิ่มเติม (ชื่อจริง, งาน, Bio)
    
    let currentFilter = 'all';
    let taskChart = null;
    let currentLang = 'th';

    // ================= INIT APP =================
    function initApp() {
        // โหลดธีม
        const savedTheme = localStorage.getItem('app_theme') || 'light';
        setTheme(savedTheme);

        // โหลดภาษา
        const savedLang = localStorage.getItem('app_lang') || 'th';
        currentLang = savedLang;
        updateLanguage();

        // เช็ค Login ค้างไว้ไหม
        const savedUser = sessionStorage.getItem(DB_SESSION_KEY);
        if (savedUser) {
            const userObj = allUsers.find(u => u.username === savedUser);
            if(userObj) {
                loginUser(userObj, false, false);
            } else { 
                showDashboard(null); 
            }
        } else { 
            showDashboard(null); 
        }
        
        updateClock(); 
        setInterval(updateClock, 1000); 
        setupRandomQuote();
        loadLinks();
        initCalendar();
    }

    // ================= THEME SYSTEM =================
    function setTheme(theme) {
        if(theme === 'dark') {
            document.body.classList.add('dark-mode');
            const btnDark = document.getElementById('btnThemeDark');
            const btnLight = document.getElementById('btnThemeLight');
            if(btnDark) btnDark.classList.add('active');
            if(btnLight) btnLight.classList.remove('active');
        } else {
            document.body.classList.remove('dark-mode');
            const btnDark = document.getElementById('btnThemeDark');
            const btnLight = document.getElementById('btnThemeLight');
            if(btnLight) btnLight.classList.add('active');
            if(btnDark) btnDark.classList.remove('active');
        }
        localStorage.setItem('app_theme', theme);
    }

    const btnLight = document.getElementById('btnThemeLight');
    const btnDark = document.getElementById('btnThemeDark');
    if(btnLight) btnLight.addEventListener('click', () => setTheme('light'));
    if(btnDark) btnDark.addEventListener('click', () => setTheme('dark'));

    // ================= AUTH SYSTEM =================
    function requireAuth(actionName) {
        if (!currentUser) {
            showToast(`กรุณาเข้าสู่ระบบก่อน ${actionName}`, "error");
            setTimeout(() => {
                document.getElementById('auth-view').classList.remove('hidden');
                switchAuthBox('login-box');
            }, 300); 
            return false;
        }
        return true;
    }

   function loginUser(userObj, remember = false, forceRedirect = true) {
        console.log("Attempting to login:", userObj.username); // เช็คใน Console

        // 1. ตั้งค่า User
        currentUser = userObj;
        sessionStorage.setItem(DB_SESSION_KEY, currentUser.username);

        // 2. พยายามโหลดระบบต่างๆ (ถ้ามี)
        try { if(typeof loadUserTasks === 'function') loadUserTasks(); } catch(e) { console.warn("Task system missing"); }
        try { if(typeof loadUserProfileExt === 'function') loadUserProfileExt(); } catch(e) { console.warn("Profile system missing"); }
        try { if(typeof loadHabits === 'function') loadHabits(); } catch(e) { console.warn("Habit system missing"); }
        try { if(typeof loadLinks === 'function') loadLinks(); } catch(e) { console.warn("Link system missing"); }
        try { if(typeof initReminderSystem === 'function') initReminderSystem(); } catch(e) { console.warn("Reminder system missing"); }
        try { if(typeof initNoteSystem === 'function') initNoteSystem(); } catch(e) { console.warn("Note system missing"); }

        // 3. เปลี่ยนหน้าจอ
        if (forceRedirect) switchTab('home-tab'); 
        
        const authView = document.getElementById('auth-view');
        if(authView) authView.classList.add('hidden');
        
        updateUI(); 

        // 4. อัปเดตปฏิทิน (ถ้ามี)
        try {
            if(typeof renderCalendar === 'function' && typeof currentMonth !== 'undefined') {
                renderCalendar(currentMonth, currentYear);
            }
        } catch(e) { console.warn("Calendar missing"); }

        // 5. แจ้งเตือน
        showToast(`Welcome ${currentUser.username}`, "success");
    }

    // ✅ แก้ไข: รับค่า email เข้ามาด้วย
    function registerUser(username, password, email) {
        // เช็คว่า Username ซ้ำไหม
        if (allUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            showToast("Username taken / มีชื่อผู้ใช้นี้แล้ว", "error"); return false;
        }
        // เช็คว่า Email ซ้ำไหม (เพิ่มใหม่)
        if (allUsers.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
            showToast("Email already registered / อีเมลนี้ถูกใช้แล้ว", "error"); return false;
        }

        // สร้าง User ใหม่พร้อมอีเมลจริง
        const newUser = { 
            username, 
            password, 
            email: email, // ใช้อีเมลที่กรอกมา
            joined: new Date().toLocaleDateString() 
        };
        
        allUsers.push(newUser);
        localStorage.setItem(DB_USERS_KEY, JSON.stringify(allUsers));
        showToast("สมัครสมาชิกสำเร็จ! กรุณาล็อกอิน", "success");
        return true;
    }

    function resetPassword(username, newPass) {
        const idx = allUsers.findIndex(u => u.username === username);
        if (idx !== -1) {
            allUsers[idx].password = newPass;
            localStorage.setItem(DB_USERS_KEY, JSON.stringify(allUsers));
            showToast("รีเซ็ตรหัสผ่านสำเร็จ!", "success");
            return true;
        } else {
            showToast("ไม่พบชื่อผู้ใช้นี้", "error");
            return false;
        }
    }

    function handleLogout() {
        sessionStorage.removeItem(DB_SESSION_KEY);
        currentUser = null; 
        userTasks = [];
        window.location.reload();
    }

    // ================= UPDATE UI (MAIN) =================
    function updateUI() {
        const els = {
            loginBtn: document.getElementById('navLoginBtn'),
            userProfile: document.getElementById('userProfileDisplay'),
            welcome: document.getElementById('welcomeSection'),
            security: document.getElementById('securitySection'),
            guestMsg: document.getElementById('guestMsgSettings'),
            navUser: document.getElementById('navUsername'),
            navAv: document.getElementById('navAvatar'),
            headUser: document.getElementById('headerUsername'),
            // Profile Elements (อาจจะไม่มีในหน้า HTML เก่า แต่กัน error ไว้)
            profUser: document.getElementById('profileUsername'),
            profAvMain: document.getElementById('profileAvatarMain')
        };

        if (currentUser) {
            const avUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`;
            
            // Toggle Elements
            if(els.loginBtn) els.loginBtn.classList.add('hidden');
            if(els.userProfile) els.userProfile.classList.remove('hidden');
            if(els.welcome) els.welcome.classList.remove('hidden');
            if(els.security) els.security.classList.remove('hidden');
            if(els.guestMsg) els.guestMsg.classList.add('hidden');
            
            // Set Text
            if(els.navUser) els.navUser.textContent = currentUser.username;
            if(els.navAv) els.navAv.src = avUrl;
            if(els.headUser) els.headUser.textContent = userProfileExt.fullName || currentUser.username;

            // Render Tasks & Chart
            renderTasks(); 
            updateRealAnalytics(); // ต้องใช้คำนี้ครับ

            // Render Profile PRO (ส่วนใหม่)
            renderProfilePro(avUrl);

        } else {
            // Guest Mode
            if(els.loginBtn) els.loginBtn.classList.remove('hidden');
            if(els.userProfile) els.userProfile.classList.add('hidden');
            if(els.welcome) els.welcome.classList.add('hidden');
            if(els.security) els.security.classList.add('hidden');
            if(els.guestMsg) els.guestMsg.classList.remove('hidden');
            
            if(els.profUser) els.profUser.textContent = "Guest";
            const taskList = document.getElementById('taskList');
            if(taskList) taskList.innerHTML = `<li style='justify-content:center; color:#999;'>Please login to view tasks</li>`;
            
            updateStats(0, 0);
        }
    }

    function showDashboard() { updateUI(); loadDailyNote(); }

    function switchTab(tabId) {
        if (tabId === 'profile-tab' && !currentUser) {
            showToast("กรุณาเข้าสู่ระบบก่อน", "error");
            setTimeout(() => {
                document.getElementById('auth-view').classList.remove('hidden');
                switchAuthBox('login-box');
            }, 300);
            return;
        }
        document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === tabId));
    }

    // ================= PROFILE PRO LOGIC (NEW) =================
    function loadUserProfileExt() {
        if(!currentUser) return;
        const key = `profile_ext_${currentUser.username}`;
        userProfileExt = JSON.parse(localStorage.getItem(key)) || {
            fullName: currentUser.username,
            jobTitle: "New User",
            bio: "",
            role: "Member"
        };
    }

    function saveUserProfileExt() {
        if(!currentUser) return;
        const key = `profile_ext_${currentUser.username}`;
        localStorage.setItem(key, JSON.stringify(userProfileExt));
        showToast("บันทึกข้อมูลส่วนตัวแล้ว", "success");
    }

    function renderProfilePro(avUrl) {
        // เช็คก่อนว่ามี Element เหล่านี้ไหม (ป้องกัน Error ถ้ายังไม่ได้แก้ HTML)
        const elUsername = document.getElementById('profileUsername');
        if(!elUsername) return; // ถ้าไม่มี แสดงว่า HTML ยังเป็นเวอร์ชั่นเก่า

        // 1. คำนวณ Level
        const completedCount = userTasks.filter(t => t.done).length;
        const xpPerTask = 50; 
        const currentXP = completedCount * xpPerTask;
        const level = Math.floor(currentXP / 500) + 1; 
        const progressPercent = ((currentXP % 500) / 500) * 100;

        // 2. แสดงผล Header Profile
        const elAvMain = document.getElementById('profileAvatarMain');
        const elRoleBadge = document.getElementById('profileRoleBadge');
        if(elAvMain) elAvMain.src = avUrl;
        if(elUsername) elUsername.textContent = userProfileExt.fullName || currentUser.username;
        if(elRoleBadge) elRoleBadge.textContent = userProfileExt.jobTitle || "Member";

        // 3. แสดงผล Stats & Level
        const elLvlNum = document.getElementById('userLevelDisplay');
        const elXpText = document.getElementById('xpText');
        const elXpBar = document.getElementById('xpBarFill');
        const elTotalDone = document.getElementById('profileTotalDone');
        const elJoined = document.getElementById('profileJoinedDate');

        if(elLvlNum) elLvlNum.textContent = level;
        if(elXpText) elXpText.textContent = `${currentXP % 500} / 500 XP`;
        if(elXpBar) elXpBar.style.width = `${progressPercent}%`;
        if(elTotalDone) elTotalDone.textContent = completedCount;
        if(elJoined) elJoined.textContent = currentUser.joined;

        // 4. ใส่ข้อมูลลงฟอร์มแก้ไข (Edit Form)
        const inpName = document.getElementById('editFullName');
        const inpEmail = document.getElementById('editEmail');
        const inpJob = document.getElementById('editJob');
        const inpBio = document.getElementById('editBio');

        if(inpName) inpName.value = userProfileExt.fullName || "";
        if(inpEmail) inpEmail.value = currentUser.email;
        if(inpJob) inpJob.value = userProfileExt.jobTitle || "";
        if(inpBio) inpBio.value = userProfileExt.bio || "";
    }

    // ================= LANGUAGE SYSTEM =================
    function updateLanguage() {
        const translations = {
            en: {
                nav_dashboard: "Dashboard", nav_profile: "Profile", nav_settings: "Settings",
                header_overview: "Overview", header_welcome: "Welcome back",
                stat_total: "Total Tasks", stat_completed: "Completed", stat_progress: "Progress",
                title_active_tasks: "My Tasks", btn_add: "Add Task", btn_save_note: "Save Note",
                title_analytics: "Analytics", title_notes: "Notes",
                ph_add_task: "Add a new task...", ph_notes: "Quick notes...",
                title_appearance: "Appearance", title_security: "Security",
                label_old_pass: "Current Password", label_new_pass: "New Password", btn_update_pass: "Update Password",
                msg_login_security: "Please login to access security settings."
            },
            th: {
                nav_dashboard: "แดชบอร์ด", nav_profile: "โปรไฟล์", nav_settings: "ตั้งค่า",
                header_overview: "ภาพรวม", header_welcome: "ยินดีต้อนรับ",
                stat_total: "งานทั้งหมด", stat_completed: "เสร็จแล้ว", stat_progress: "ความคืบหน้า",
                title_active_tasks: "รายการงานของฉัน", btn_add: "เพิ่มงาน", btn_save_note: "บันทึก",
                title_analytics: "สถิติการทำงาน", title_notes: "บันทึกช่วยจำ",
                ph_add_task: "เพิ่มงานใหม่ที่นี่...", ph_notes: "จดบันทึกด่วน...",
                title_appearance: "การแสดงผล", title_security: "ความปลอดภัย",
                label_old_pass: "รหัสผ่านเดิม", label_new_pass: "รหัสผ่านใหม่", btn_update_pass: "อัปเดตรหัสผ่าน",
                msg_login_security: "กรุณาเข้าสู่ระบบเพื่อตั้งค่าความปลอดภัย"
            }
        };

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(translations[currentLang][key]) el.textContent = translations[currentLang][key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if(translations[currentLang][key]) el.placeholder = translations[currentLang][key];
        });
        const langText = document.getElementById('langText');
        const langFlag = document.getElementById('langFlag');
        if(langText && langFlag) {
            if (currentLang === 'th') { langText.textContent = "TH"; langFlag.src = "https://flagcdn.com/w40/th.png"; }
            else { langText.textContent = "EN"; langFlag.src = "https://flagcdn.com/w40/gb.png"; }
        }
    }

    // ================= EVENTS & HANDLERS =================

    // Login Form
   // ✅ แก้ไข: ล็อกอินด้วย Username หรือ Email ก็ได้
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = document.getElementById('loginUser').value.trim(); // รับค่าเป็น Username หรือ Email
            const pass = document.getElementById('loginPass').value.trim();
            
            // ค้นหา User ที่ชื่อตรง หรือ อีเมลตรง
            const found = allUsers.find(u => 
                (u.username.toLowerCase() === inputVal.toLowerCase() || 
                 (u.email && u.email.toLowerCase() === inputVal.toLowerCase())) && 
                u.password === pass
            );

            if (found) loginUser(found, false, true);
            else showToast("ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง", "error");
        });
    }

    // Register Form
  // ✅ แก้ไข: ส่งค่า email ไปให้ฟังก์ชัน registerUser
    const regForm = document.getElementById('registerForm');
    if(regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('regUser').value.trim();
            const pass = document.getElementById('regPass').value.trim();
            // ดึงค่าอีเมล
            const email = document.getElementById('regEmail').value.trim();

            if(user && pass && email) {
                if(registerUser(user, pass, email)) {
                    setTimeout(() => switchAuthBox('login-box'), 1000);
                    regForm.reset();
                }
            }
        });
    }

    // Forgot Password Form
    const forgotForm = document.getElementById('forgotForm');
    if(forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('forgotEmail').value.trim();
            const newPass = document.getElementById('forgotNewPass').value.trim();
            if(user && newPass) {
                if(resetPassword(user, newPass)) {
                    setTimeout(() => switchAuthBox('login-box'), 1000);
                    forgotForm.reset();
                }
            }
        });
    }

   // [วางทับจุดที่ 1] ปุ่มเพิ่มงานแบบเก็บข้อมูล Analytics
    // ==========================================
    // ✅ ปุ่มเพิ่มงาน (เวอร์ชันสมบูรณ์ + แก้บั๊กงานไม่ขึ้น)
    // ==========================================
    const addTaskBtn = document.getElementById('addTaskBtn');
    
    // ล้าง Event เก่าทิ้ง (ป้องกันการกดเบิ้ล)
    const newBtn = addTaskBtn.cloneNode(true);
    addTaskBtn.parentNode.replaceChild(newBtn, addTaskBtn);

    newBtn.addEventListener('click', () => {
        // 1. เช็คสิทธิ์
        if (!requireAuth("เพิ่มงาน")) return;
        
        // 2. ดึงค่า
        const input = document.getElementById('newTask');
        const priority = document.getElementById('taskPriority').value;
        const category = document.getElementById('taskCategory').value;
        const date = document.getElementById('taskDueDate').value;
        
        if (input.value.trim()) {
            // เพิ่มงานเข้า Array
            userTasks.push({ 
                text: input.value.trim(), 
                done: false, 
                priority, 
                category, 
                date,
                createdDate: new Date().toISOString(),
                completedDate: null, // ยังไม่เสร็จ ค่าต้องเป็น null
                postponedCount: 0 
            });
            
            saveUserTasks(); 
            input.value = ""; // ล้างช่องกรอก

            // 🔥 บังคับรีเซ็ตหน้าจอให้เห็นงานทันที
            currentFilter = 'all'; 
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const btnAll = document.querySelector('[data-filter="all"]');
            if(btnAll) btnAll.classList.add('active');

            renderTasks(); // วาดรายการงานใหม่
            
            // อัปเดตกราฟ (แม้จะยังไม่มีข้อมูลใหม่ แต่ให้รีเฟรชรอไว้)
            if(typeof updateRealAnalytics === 'function') updateRealAnalytics();
            if(typeof renderCalendar === "function") renderCalendar(currentMonth, currentYear);
            
            // อัปเดต Profile
            if(currentUser && typeof renderProfilePro === 'function') {
                 const avUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`;
                 renderProfilePro(avUrl);
            }

            showToast("เพิ่มงานสำเร็จ!", "success");

            // เลื่อนจอลงไปหางานใหม่
            setTimeout(() => {
                const list = document.getElementById('taskList');
                if(list) list.scrollTop = list.scrollHeight;
            }, 100);
        } else {
            showToast("กรุณากรอกชื่องาน", "error");
        }
    });

   // ✅ Change Password (เวอร์ชันเช็ครหัสเก่า + ความปลอดภัย)
    const changePassBtn = document.getElementById('changePassBtn');
    if(changePassBtn) {
        changePassBtn.addEventListener('click', () => {
            // 1. เช็คสิทธิ์ Login
            if (!requireAuth("เปลี่ยนรหัสผ่าน")) return;

            const oldPassInput = document.getElementById('oldPass');
            const newPassInput = document.getElementById('newPass');
            
            const oldPass = oldPassInput.value;
            const newPass = newPassInput.value;

            // 2. หา User ในระบบ
            const idx = allUsers.findIndex(u => u.username === currentUser.username);
            
            if(idx !== -1) {
                // 3. ตรวจสอบรหัสเดิม (เพื่อความปลอดภัย)
                if(allUsers[idx].password !== oldPass) {
                    showToast("รหัสผ่านเดิมไม่ถูกต้อง (Wrong current password)", "error");
                    return;
                }

                // 4. ตรวจสอบรหัสใหม่
                if(newPass.length < 4) {
                    showToast("รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร", "warning");
                    return;
                }

                if(newPass === oldPass) {
                    showToast("รหัสผ่านใหม่ซ้ำกับรหัสเดิม", "warning");
                    return;
                }

                // 5. บันทึก
                allUsers[idx].password = newPass;
                localStorage.setItem(DB_USERS_KEY, JSON.stringify(allUsers)); 
                
                showToast("เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่", "success");
                
                // เคลียร์ช่อง
                oldPassInput.value = "";
                newPassInput.value = "";

                // บังคับ Logout เพื่อความปลอดภัย
                setTimeout(handleLogout, 2000);
            }
        });
    }
    
    // ✅ เพิ่มฟังก์ชันกดรูปตา (Show/Hide Password) ให้ทำงานกับช่องใหม่นี้
    // (โค้ดเดิมของคุณมี .toggle-pass อยู่แล้ว แต่มันอาจจะทำงานแค่ตอนโหลดหน้าแรก 
    // ถ้ากดแล้วไม่ติด ให้เพิ่มบรรทัดนี้ลงไปท้ายสุดครับ)
    document.querySelectorAll('.toggle-pass').forEach(i => {
        // ล้าง Event เก่าก่อนกันเบิ้ล
        const newIcon = i.cloneNode(true);
        i.parentNode.replaceChild(newIcon, i);
        
        newIcon.addEventListener('click', function() { 
            const inp = this.parentElement.querySelector('input'); 
            if(inp) {
                inp.type = inp.type === 'password' ? 'text' : 'password'; 
                this.classList.toggle('bx-show'); 
                this.classList.toggle('bx-hide'); 
            }
        });
    });
    
    // Save Profile (NEW Button)
    const saveProfBtn = document.getElementById('saveProfileBtn');
    if(saveProfBtn) {
        saveProfBtn.addEventListener('click', () => {
            if(!requireAuth("แก้ไขโปรไฟล์")) return;
            
            const newName = document.getElementById('editFullName').value;
            const newJob = document.getElementById('editJob').value;
            const newBio = document.getElementById('editBio').value;

            userProfileExt.fullName = newName;
            userProfileExt.jobTitle = newJob;
            userProfileExt.bio = newBio;
            
            saveUserProfileExt();
            updateUI(); // รีโหลดหน้าเพื่อแสดงผลใหม่
        });
    }

    // Logout Profile Button (NEW Button in Profile Tab)
    const logoutProfBtn = document.getElementById('btnLogOutProfile');
    if(logoutProfBtn) {
        logoutProfBtn.addEventListener('click', handleLogout);
    }

    // Common Buttons
    const btnNavLogin = document.getElementById('navLoginBtn');
    if(btnNavLogin) btnNavLogin.addEventListener('click', () => { document.getElementById('auth-view').classList.remove('hidden'); switchAuthBox('login-box'); });
    
    document.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', () => document.getElementById('auth-view').classList.add('hidden')));
    
    const btnLogout = document.getElementById('logoutBtn');
    if(btnLogout) btnLogout.addEventListener('click', handleLogout);
    
    document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.querySelectorAll('[data-target]').forEach(l => l.addEventListener('click', e => { e.preventDefault(); switchAuthBox(l.dataset.target); }));
    
    const btnLang = document.getElementById('langBtn');
    if(btnLang) btnLang.addEventListener('click', () => { currentLang = currentLang === 'th' ? 'en' : 'th'; localStorage.setItem('app_lang', currentLang); updateLanguage(); });

    // Search
    const searchInput = document.getElementById('searchTask');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderTasks(e.target.value.toLowerCase());
            const clearBtn = document.getElementById('clearSearchBtn');
            if(clearBtn) clearBtn.style.display = e.target.value ? 'block' : 'none';
        });
    }
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if(clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            document.getElementById('searchTask').value = ''; 
            renderTasks(''); 
            clearSearchBtn.style.display = 'none';
        });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            const sVal = document.getElementById('searchTask').value.toLowerCase();
            renderTasks(sVal);
        });
    });

    const btnSaveNote = document.getElementById('saveNoteBtn');
    if(btnSaveNote) btnSaveNote.addEventListener('click', () => { 
        if (!requireAuth("บันทึก")) return; 
        localStorage.setItem(`note_${currentUser.username}`, document.getElementById('dailyNote').value); 
        showToast("Note Saved", "success"); 
    });

    const btnSetReminder = document.getElementById('setReminderBtn');
    if(btnSetReminder) btnSetReminder.addEventListener('click', () => { 
        if (!requireAuth("ตั้งเวลา")) return; 
        const timeStr = document.getElementById('reminderTime').value; 
        if (!timeStr) return showToast("Select time", "error"); 
        showToast(`Reminder set: ${timeStr}`, "success"); 
    });

    document.querySelectorAll('.toggle-pass').forEach(i => i.addEventListener('click', function() { const inp = this.parentElement.querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password'; this.classList.toggle('bx-show'); this.classList.toggle('bx-hide'); }));

    // ================= HELPER FUNCTIONS =================
    function switchAuthBox(id) { ['login-box', 'register-box', 'forgot-box'].forEach(bid => document.getElementById(bid).classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    
    function saveUserTasks() { if(currentUser) localStorage.setItem(`tasks_${currentUser.username}`, JSON.stringify(userTasks)); }
    function loadUserTasks() { if(currentUser) userTasks = JSON.parse(localStorage.getItem(`tasks_${currentUser.username}`)) || []; }
    
   // ================= RENDER TASKS (SMART PRIORITY) =================
    function renderTasks(filterText = "") {
        const list = document.getElementById('taskList'); 
        if(!list) return;
        
        list.innerHTML = "";
        if(userSettings && userSettings.compactView) list.classList.add('compact-mode');
        else list.classList.remove('compact-mode');

        let display = userTasks.map((t, i) => ({...t, index: i}));
        
        display.sort((a, b) => { 
            if(userSettings && userSettings.moveDone) {
                if (a.done && !b.done) return 1;
                if (!a.done && b.done) return -1;
            }
            if(!a.date) return 1; 
            if(!b.date) return -1; 
            return new Date(a.date) - new Date(b.date); 
        });

        if (currentFilter === 'pending') display = display.filter(t => !t.done);
        if (currentFilter === 'completed') display = display.filter(t => t.done);
        if (filterText) display = display.filter(t => t.text.toLowerCase().includes(filterText));
        
        if(display.length===0) list.innerHTML = `<li style="justify-content:center; color:#999;">No tasks found</li>`;
        
        const today = new Date();
        today.setHours(0,0,0,0);

        display.forEach(t => {
            let priorityDisplay = t.priority;
            let badgeClass = t.priority === 'high' ? 'badge-high' : t.priority === 'medium' ? 'badge-medium' : 'badge-normal';
            let rowClass = "";
            let extraIcon = "";

            if (userSettings.smartPriority && t.date && !t.done) {
                const taskDate = new Date(t.date);
                taskDate.setHours(0,0,0,0);
                const diffTime = taskDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    priorityDisplay = "OVERDUE";
                    badgeClass = "badge-overdue";
                    rowClass = "task-overdue";
                    extraIcon = "<i class='bx bxs-error-circle' style='color:#ef4444; margin-left:5px;'></i>";
                } else if (diffDays <= 1) { 
                    priorityDisplay = "URGENT";
                    badgeClass = "badge-high";
                    rowClass = "task-urgent";
                    extraIcon = "<span class='urgent-fire'>🔥</span>";
                }
            }
            
            const cat = t.category ? `cat-${t.category.toLowerCase()}` : 'cat-work';
            
            list.innerHTML += `
                <li class="${t.done?'completed':''} ${rowClass}">
                    <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${t.index})">
                    <div class="task-content">
                        <span class="task-title">${t.text} ${extraIcon}</span>
                        <div class="task-meta">
                            <span class="cat-badge ${cat}">${t.category}</span>
                            <span class="badge ${badgeClass}">${priorityDisplay}</span>
                            ${t.date ? `<span style="${rowClass.includes('overdue') ? 'color:#ef4444; font-weight:bold;' : ''}">${t.date}</span>` : ''}
                        </div>
                    </div>
                    
                    ${!t.done && t.date ? `
                    <button class="btn-icon-only" onclick="postponeTask(${t.index})" title="เลื่อนไปพรุ่งนี้ (+1 วัน)" style="margin-right:5px;">
                        <i class='bx bx-time-five' style="color:var(--warning);"></i>
                    </button>` : ''}
                    
                    <button class="btn-icon-only btn-delete" onclick="deleteTask(${t.index})"><i class='bx bx-trash'></i></button>
                </li>`;
        });
        updateStats(userTasks.length, userTasks.filter(t=>t.done).length);
    }

    // Global Functions for HTML onClick
   // ==========================================
    window.toggleTask = function(i) { 
        // 1. สลับสถานะ เสร็จ/ไม่เสร็จ
        userTasks[i].done = !userTasks[i].done; 
        
        // 2. ถ้าเสร็จ ให้บันทึกเวลาปัจจุบัน (สำคัญมาก! กราฟใช้ค่านี้)
        if(userTasks[i].done) {
            userTasks[i].completedDate = new Date().toISOString(); 
            // เล่นเสียงเอฟเฟกต์ (ถ้ามีฟังก์ชันนี้)
            if(typeof playSoundSuccess === 'function') playSoundSuccess();
            showToast("เยี่ยมมาก! งานเสร็จแล้ว 🎉", "success");
        } else {
            // ถ้าติ๊กออก ให้ลบเวลาทิ้ง
            userTasks[i].completedDate = null; 
        }
        
        // 3. บันทึกข้อมูลลงเครื่อง
        saveUserTasks(); 
        
        // 4. เรนเดอร์หน้าจอใหม่
        renderTasks();
        
        // 5. สั่งอัปเดตกราฟทันที! (บรรทัดนี้แหละที่หายไป)
        if(typeof updateRealAnalytics === 'function') updateRealAnalytics();

        // อัปเดต Profile
        if(currentUser && typeof renderProfilePro === 'function') {
            const avUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`;
            renderProfilePro(avUrl);
        }
    }

    function updateStats(total, completed) { 
        const p = total===0?0:Math.round((completed/total)*100); 
        
        const elTotal = document.getElementById('homeTotalTasks');
        const elComp = document.getElementById('homeCompletedTasks');
        const elBar = document.getElementById('progressBarHome');

        if(elTotal) elTotal.textContent = total; 
        if(elComp) elComp.textContent = completed; 
        if(elBar) elBar.style.width = p+"%"; 
        
        if(taskChart) { 
            taskChart.data.datasets[0].data = [completed, total===0?1:total-completed]; 
            taskChart.update(); 
        } 
    }

    function initChart() { 
        const ctxEl = document.getElementById('taskChart');
        if(!ctxEl) return;
        const ctx = ctxEl.getContext('2d'); 
        
        if(taskChart) taskChart.destroy(); 
        
        taskChart = new Chart(ctx, { 
            type: 'doughnut', 
            data: { 
                labels: ['Done', 'Pending'], 
                datasets: [{ 
                    data: [0, 1], 
                    backgroundColor: ['#10b981', '#cbd5e1'], 
                    borderWidth: 0 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%', 
                plugins: { legend: { display: false } } 
            } 
        }); 
    }

    function loadDailyNote() { 
        if(currentUser) {
            const noteArea = document.getElementById('dailyNote');
            if(noteArea) noteArea.value = localStorage.getItem(`note_${currentUser.username}`) || ""; 
        }
    }

    function updateClock() { 
        const dateEl = document.getElementById('todayDate');
        if(dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); 
    }

    function showToast(msg, type="info") { 
        const container = document.getElementById('toastContainer');
        if(!container) return;
        const t = document.createElement('div'); 
        t.className = 'toast'; 
        t.textContent = msg; 
        if(type==="error") t.style.backgroundColor = "#ef4444"; 
        container.appendChild(t); 
        setTimeout(() => { 
            t.style.opacity="0"; 
            setTimeout(()=>t.remove(),400); 
        }, 3000); 
    }

    function setupRandomQuote() { 
        const quotes = ["Believe you can.", "Keep going.", "Focus on progress.", "One step at a time."]; 
        const q = document.getElementById('quoteDisplay'); 
        if(q) q.textContent = quotes[Math.floor(Math.random()*quotes.length)]; 
    }

    // ================= DATA BACKUP SYSTEM =================

    // 1. ฟังก์ชัน Backup (Export)
    const btnBackup = document.getElementById('btnBackup');
    if(btnBackup) {
        btnBackup.addEventListener('click', () => {
            if(!requireAuth("สำรองข้อมูล")) return;

            // รวบรวมข้อมูลทั้งหมดที่เกี่ยวกับ User นี้
            const backupData = {
                user: currentUser,
                tasks: userTasks,
                profile: userProfileExt || {},
                note: localStorage.getItem(`note_${currentUser.username}`) || "",
                version: "1.0",
                timestamp: new Date().toISOString()
            };

            // แปลงเป็น JSON String
            const dataStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            // สร้าง Link เพื่อดาวน์โหลดอัตโนมัติ
            const a = document.createElement('a');
            a.href = url;
            a.download = `OmniTask_Backup_${currentUser.username}_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast("ดาวน์โหลดไฟล์ Backup สำเร็จ!", "success");
        });
    }

    // 2. ฟังก์ชัน Restore (Import)
    const btnRestoreTrigger = document.getElementById('btnRestoreTrigger');
    const fileRestore = document.getElementById('fileRestore');

    if(btnRestoreTrigger && fileRestore) {
        btnRestoreTrigger.addEventListener('click', () => fileRestore.click());

        fileRestore.addEventListener('change', (e) => {
            if(!requireAuth("กู้คืนข้อมูล")) return;
            
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    // ตรวจสอบความถูกต้องของไฟล์คร่าวๆ
                    if (!data.user || !data.tasks) {
                        throw new Error("Invalid format");
                    }

                    // ยืนยันก่อนทับข้อมูลเดิม
                    if(confirm(`ต้องการกู้คืนข้อมูลของ ${data.user.username} ใช่หรือไม่? \nข้อมูลปัจจุบันจะถูกแทนที่!`)) {
                        
                        // บันทึกลง LocalStorage
                        userTasks = data.tasks;
                        userProfileExt = data.profile || {};
                        
                        localStorage.setItem(`tasks_${currentUser.username}`, JSON.stringify(userTasks));
                        localStorage.setItem(`profile_ext_${currentUser.username}`, JSON.stringify(userProfileExt));
                        if(data.note) localStorage.setItem(`note_${currentUser.username}`, data.note);

                        // รีเฟรชหน้าจอ
                        renderTasks();
                        renderProfilePro(`https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`);
                        showToast("กู้คืนข้อมูลสำเร็จ!", "success");
                        setTimeout(() => window.location.reload(), 1000); // รีโหลดเพื่อให้มั่นใจ
                    }
                } catch (err) {
                    showToast("ไฟล์ไม่ถูกต้อง หรือเสียหาย", "error");
                    console.error(err);
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // Reset input
        });
    }

    // 3. ฟังก์ชัน Reset (ล้างข้อมูลทั้งหมด)
    const btnClearAll = document.getElementById('btnClearAll');
    if(btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            const confirmed = confirm("⚠️ คำเตือน: คุณต้องการลบข้อมูลแอปทั้งหมดในเครื่องนี้ใช่หรือไม่?\n(User, Task, Setting จะหายหมด)");
            if(confirmed) {
                localStorage.clear();
                sessionStorage.clear();
                alert("ล้างข้อมูลเรียบร้อย แอปจะเริ่มใหม่");
                window.location.reload();
            }
        });
    }

    // ================= CALENDAR SYSTEM =================
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = null; // เก็บวันที่ที่ User กดเลือก

    function initCalendar() {
        renderCalendar(currentMonth, currentYear);
        
        // Event Listeners
        const prevBtn = document.getElementById('prevMonthBtn');
        const nextBtn = document.getElementById('nextMonthBtn');
        const todayBtn = document.getElementById('todayBtn');

        if(prevBtn) prevBtn.addEventListener('click', () => changeMonth(-1));
        if(nextBtn) nextBtn.addEventListener('click', () => changeMonth(1));
        if(todayBtn) todayBtn.addEventListener('click', () => {
            const now = new Date();
            currentMonth = now.getMonth();
            currentYear = now.getFullYear();
            selectedDate = null; // Clear filter
            renderCalendar(currentMonth, currentYear);
            renderTasks(""); // Reset task list
        });
    }

    function changeMonth(step) {
        currentMonth += step;
        if(currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        } else if(currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar(currentMonth, currentYear);
    }

    function renderCalendar(month, year) {
        const grid = document.getElementById('calendarGrid');
        const monthDisplay = document.getElementById('monthYearDisplay');
        if(!grid || !monthDisplay) return;

        // ชื่อเดือน
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthDisplay.textContent = `${monthNames[month]} ${year}`;

        grid.innerHTML = "";

        // คำนวณวัน
        const firstDay = new Date(year, month, 1).getDay(); // วันแรกเริ่มช่องไหน (0=Sun)
        const daysInMonth = new Date(year, month + 1, 0).getDate(); // เดือนนี้มีกี่วัน

        // ช่องว่างก่อนวันแรก
        for(let i=0; i<firstDay; i++) {
            grid.innerHTML += `<div class="calendar-day empty"></div>`;
        }

        // วนลูปสร้างวัน
        const today = new Date();
        for(let d=1; d<=daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; // format YYYY-MM-DD
            
            // เช็คว่าวันนี้คือ "วันนี้" หรือไม่
            const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            const isSelected = (selectedDate === dateStr);
            
            // เช็คว่ามีงานในวันนี้ไหม?
            const hasTask = userTasks.some(t => t.date === dateStr && !t.done);
            
            // สร้าง HTML
            const dotHtml = hasTask ? `<div class="task-dot"></div>` : '';
            const classes = `calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'active-date' : ''}`;
            
            grid.innerHTML += `
                <div class="${classes}" onclick="filterTasksByDate('${dateStr}')">
                    ${d}
                    ${dotHtml}
                </div>
            `;
        }
    }

    // ฟังก์ชันกรองงานเมื่อกดวันที่
    window.filterTasksByDate = function(dateStr) {
        // Toggle Filter
        if(selectedDate === dateStr) {
            selectedDate = null; // กดซ้ำเพื่อยกเลิก
        } else {
            selectedDate = dateStr;
        }
        
        // Re-render Calendar (เพื่อ update สีปุ่มที่เลือก)
        renderCalendar(currentMonth, currentYear);
        
        // Filter Task List ข้างล่าง
        const list = document.getElementById('taskList');
        list.innerHTML = "";
        
        let filteredTasks = userTasks.filter(t => {
            if(selectedDate) return t.date === selectedDate;
            return true; // ถ้าไม่ได้เลือกวัน ให้โชว์หมด
        });

        // (ใช้ Logic render เดิม แต่เปลี่ยน source data)
        if(filteredTasks.length === 0) {
            list.innerHTML = `<li style="justify-content:center; color:#999;">No tasks for ${selectedDate || 'this selection'}</li>`;
        } else {
            // Render เฉพาะงานที่กรองมา
            filteredTasks.forEach((t) => {
                // หา index จริงใน userTasks เพื่อให้ปุ่มลบทำงานถูก
                const realIndex = userTasks.indexOf(t);
                
                const cat = t.category ? `cat-${t.category.toLowerCase()}` : 'cat-work';
                const badge = t.priority === 'high' ? 'badge-high' : t.priority === 'medium' ? 'badge-medium' : 'badge-normal';
                
                list.innerHTML += `
                    <li class="${t.done?'completed':''}">
                        <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${realIndex})">
                        <div class="task-content">
                            <span class="task-title">${t.text}</span>
                            <div class="task-meta">
                                <span class="cat-badge ${cat}">${t.category}</span>
                                <span class="badge ${badge}">${t.priority}</span>
                                ${t.date}
                            </div>
                        </div>
                        <button class="btn-icon-only" onclick="deleteTask(${realIndex})"><i class='bx bx-trash'></i></button>
                    </li>`;
            });
        }
    }

    // ================= QUICK LINKS SYSTEM =================
    let userLinks = [];

    function loadLinks() {
        if(!currentUser) return;
        const saved = localStorage.getItem(`links_${currentUser.username}`);
        userLinks = saved ? JSON.parse(saved) : [
            { name: "Google", url: "https://google.com" },
            { name: "ChatGPT", url: "https://chat.openai.com" }
        ]; // Default links
        renderLinks();
    }

    function saveLinks() {
        if(!currentUser) return;
        localStorage.setItem(`links_${currentUser.username}`, JSON.stringify(userLinks));
    }

    function renderLinks() {
        const list = document.getElementById('linkList');
        if(!list) return;
        list.innerHTML = "";
        
        userLinks.forEach((l, index) => {
            // ดึงไอคอนจาก Google Favicon API
            const iconUrl = `https://www.google.com/s2/favicons?domain=${l.url}&sz=64`;
            
            list.innerHTML += `
                <div class="link-item-wrapper" style="position:relative;">
                    <a href="${l.url}" target="_blank" class="link-item">
                        <img src="${iconUrl}" class="link-icon" onerror="this.src='https://unpkg.com/boxicons@2.1.4/svg/regular/bx-globe.svg'">
                        <span class="link-title">${l.name}</span>
                    </a>
                    <div class="btn-delete-link" onclick="deleteLink(${index})" title="Remove">×</div>
                </div>
            `;
        });
    }

    // Toggle Form
    const addLinkBtn = document.getElementById('addLinkBtn');
    const linkForm = document.getElementById('linkForm');
    const saveLinkBtn = document.getElementById('saveLinkBtn');

    if(addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            linkForm.classList.toggle('hidden');
        });
    }

    if(saveLinkBtn) {
        saveLinkBtn.addEventListener('click', () => {
            const name = document.getElementById('linkName').value.trim();
            let url = document.getElementById('linkUrl').value.trim();
            
            if(name && url) {
                if(!url.startsWith('http')) url = 'https://' + url;
                
                userLinks.push({ name, url });
                saveLinks();
                renderLinks();
                
                // Clear & Hide
                document.getElementById('linkName').value = "";
                document.getElementById('linkUrl').value = "";
                linkForm.classList.add('hidden');
            }
        });
    }

    window.deleteLink = function(index) {
        if(confirm("ลบทางลัดนี้?")) {
            userLinks.splice(index, 1);
            saveLinks();
            renderLinks();
        }
    }
    
    // ================= REAL REMINDER SYSTEM =================
    let alarmInterval = null;
    let activeAlarmTime = null;

    function initReminderSystem() {
        // โหลดค่าเดิมที่เคยตั้งไว้ (ถ้ามี)
        if (!currentUser) return;
        const savedAlarm = localStorage.getItem(`alarm_${currentUser.username}`);
        
        if (savedAlarm) {
            setAlarm(savedAlarm, false); // false = ไม่ต้อง save ซ้ำ
        }

        // ขออนุญาตแจ้งเตือนบน Browser
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    function setAlarm(timeStr, saveToDB = true) {
        activeAlarmTime = timeStr;
        
        // UI Update
        document.getElementById('reminderTime').value = timeStr;
        document.getElementById('reminderStatus').style.display = 'block';
        document.getElementById('alarmTimeDisplay').textContent = timeStr;
        document.getElementById('setReminderBtn').classList.add('hidden');
        document.getElementById('clearReminderBtn').classList.remove('hidden');

        // Logic
        if (saveToDB && currentUser) {
            localStorage.setItem(`alarm_${currentUser.username}`, timeStr);
            showToast(`ตั้งปลุกเวลา ${timeStr} แล้ว`, "success");
        }

        // Start Checking
        clearInterval(alarmInterval);
        alarmInterval = setInterval(() => {
            const now = new Date();
            const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            if (currentStr === activeAlarmTime) {
                triggerAlarm();
            }
        }, 1000); // เช็คทุกวินาที
    }

    function clearAlarm() {
        clearInterval(alarmInterval);
        activeAlarmTime = null;
        if (currentUser) localStorage.removeItem(`alarm_${currentUser.username}`);

        // UI Reset
        document.getElementById('reminderTime').value = "";
        document.getElementById('reminderStatus').style.display = 'none';
        document.getElementById('setReminderBtn').classList.remove('hidden');
        document.getElementById('clearReminderBtn').classList.add('hidden');
        
        showToast("ยกเลิกการแจ้งเตือนแล้ว", "info");
    }

    function triggerAlarm() {
        clearInterval(alarmInterval); // หยุดเช็ค (ปลุกทีเดียว)
        
        // 1. เล่นเสียง
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // เสียงกระดิ่ง
        audio.play().catch(e => console.log("Audio play failed", e));

        // 2. แจ้งเตือน Browser
        if (Notification.permission === "granted") {
            new Notification("Omni Task Manager", { 
                body: `⏰ ถึงเวลาแล้ว! (${activeAlarmTime})`,
                icon: "https://cdn-icons-png.flaticon.com/512/780/780270.png"
            });
        }

        // 3. แจ้งเตือนในเว็บ
        alert(`⏰ ถึงเวลาแล้ว! (${activeAlarmTime})\nReminder Alert!`);
        
        // เคลียร์ค่าหลังปลุกเสร็จ
        clearAlarm();
    }

    // Event Listeners for Reminder
    const btnSetRemind = document.getElementById('setReminderBtn');
    const btnClearRemind = document.getElementById('clearReminderBtn');

    if (btnSetRemind) {
        btnSetRemind.addEventListener('click', () => {
            if (!requireAuth("ตั้งเวลา")) return;
            const val = document.getElementById('reminderTime').value;
            if (val) setAlarm(val);
            else showToast("กรุณาเลือกเวลา", "error");
        });
    }

    if (btnClearRemind) {
        btnClearRemind.addEventListener('click', clearAlarm);
    }

    // ================= REAL NOTES SYSTEM (AUTO SAVE) =================
    const noteArea = document.getElementById('dailyNote');
    const noteStatus = document.getElementById('noteSaveStatus');
    let noteTimeout;

    function initNoteSystem() {
        if (!currentUser) return;
        // โหลด Note
        const savedNote = localStorage.getItem(`note_${currentUser.username}`);
        if (noteArea) noteArea.value = savedNote || "";
    }

    if (noteArea) {
        // 1. Auto Save เมื่อพิมพ์ (Debounce 1 วินาที)
        noteArea.addEventListener('input', () => {
            if (!currentUser) return;
            
            noteStatus.textContent = "Saving...";
            clearTimeout(noteTimeout);
            
            noteTimeout = setTimeout(() => {
                localStorage.setItem(`note_${currentUser.username}`, noteArea.value);
                const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                noteStatus.textContent = `Saved at ${time}`;
            }, 1000);
        });

        // 2. Manual Save Button
        document.getElementById('saveNoteBtn').addEventListener('click', () => {
            if (!requireAuth("บันทึก")) return;
            localStorage.setItem(`note_${currentUser.username}`, noteArea.value);
            showToast("บันทึกเรียบร้อย!", "success");
            noteStatus.textContent = "Saved manually";
        });
    }
    // ================= GENERAL PREFERENCES SYSTEM (UPDATED) =================
    
    let userSettings = {
        soundFx: true,
        confirmDel: true,
        moveDone: true,      // (ใหม่) ย้ายงานเสร็จลงล่าง
        compactView: false,
        smartPriority: true  
    };

    function initSettings() {
        // 1. โหลดค่า
        const saved = localStorage.getItem('app_settings');
        if(saved) userSettings = JSON.parse(saved);

        // 2. เชื่อมต่อปุ่มสวิตช์ต่างๆ
        setupToggle('toggleSoundFx', 'soundFx');
        setupToggle('toggleConfirmDel', 'confirmDel');
        
        // (ใหม่) สวิตช์ย้ายงาน
        setupToggle('toggleMoveDone', 'moveDone', () => {
            renderTasks(); // กดปุ๊บ เรียงใหม่ปั๊บ
        });

        // (ใหม่) สวิตช์ Compact
        setupToggle('toggleCompactView', 'compactView', () => {
            renderTasks(); // กดปุ๊บ เปลี่ยนทรงปั๊บ
        });

        // ในฟังก์ชัน initSettings()
        setupToggle('toggleSmartPriority', 'smartPriority', () => {
            renderTasks();
         });    
    }

    // ฟังก์ชันช่วยเชื่อมปุ่ม (Helper)
    function setupToggle(id, key, callback) {
        const el = document.getElementById(id);
        if(el) {
            el.checked = userSettings[key];
            el.addEventListener('change', (e) => {
                userSettings[key] = e.target.checked;
                saveSettings();
                if(callback) callback();
            });
        }
    }

    function saveSettings() {
        localStorage.setItem('app_settings', JSON.stringify(userSettings));
    }

    function playSoundSuccess() {
        if(!userSettings.soundFx) return;
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); 
        audio.volume = 0.5;
        audio.play().catch(e => console.log(e));
    }

    // ================= OVERRIDE FUNCTIONS (แก้ของเดิม) =================

    // 1. แก้ deleteTask ให้เช็ค "ยืนยันก่อนลบ"
    window.deleteTask = function(i) { 
        if(userSettings.confirmDel) {
            // ถ้าเปิด setting ไว้ ให้ถามก่อน
            if(!confirm("คุณต้องการลบงานนี้ใช่หรือไม่?")) return;
        }
        // ลบเลย
        userTasks.splice(i, 1); 
        saveUserTasks(); 
        renderTasks(); 
        if(typeof renderCalendar === 'function' && typeof currentMonth !== 'undefined') renderCalendar(currentMonth, currentYear);
        if(typeof renderProfilePro === 'function') renderProfilePro(`https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`);
    }

    // 2. แก้ toggleTask ให้มี "เสียงเอฟเฟกต์"
    window.toggleTask = function(i) { 
        userTasks[i].done = !userTasks[i].done; 
        
        // ถ้าติ๊กถูก (ทำเสร็จ) ให้เล่นเสียง
        if(userTasks[i].done) {
            playSoundSuccess();
            showToast("Task Completed! Great Job!", "success");
        }
        
        saveUserTasks(); 
        renderTasks();
        if(typeof renderProfilePro === 'function') renderProfilePro(`https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`);
    }
    // [วางเพิ่มท้ายไฟล์] ฟังก์ชันระบบ Analytics ใหม่ และ Postpone
    
    // 1. ฟังก์ชันเลื่อนวัน
    window.postponeTask = function(index) {
        const task = userTasks[index];
        if(!task.date) {
            showToast("งานนี้ไม่มีวันที่กำหนด", "error");
            return;
        }
        const currentDate = new Date(task.date);
        currentDate.setDate(currentDate.getDate() + 1);
        task.date = currentDate.toISOString().split('T')[0];
        
        task.postponedCount = (task.postponedCount || 0) + 1;
        
        saveUserTasks();
        renderTasks();
        updateRealAnalytics();
        showToast(`เลื่อนงานไปพรุ่งนี้แล้ว (ครั้งที่ ${task.postponedCount})`, "warning");
    }

    // 2. ฟังก์ชันคำนวณกราฟ Productivity
    function updateRealAnalytics() {
        const ctx = document.getElementById('productivityChart');
        if(ctx) {
            const labels = [];
            const dataPoints = [];
            const today = new Date();
            
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
                // นับเฉพาะงานที่มี completedDate ตรงกับวันนี้
                const count = userTasks.filter(t => t.done && t.completedDate && t.completedDate.startsWith(dateStr)).length;
                dataPoints.push(count);
            }

            if(window.myProductivityChart) window.myProductivityChart.destroy();
            
            window.myProductivityChart = new Chart(ctx, {
                type: 'bar', // เปลี่ยนเป็นกราฟแท่ง
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tasks Done',
                        data: dataPoints,
                        backgroundColor: '#2563eb',
                        borderRadius: 4,
                        barThickness: 12
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });

            // อัปเดตตัวเลข
            const weekTotal = dataPoints.reduce((a,b) => a+b, 0);
            const elWeek = document.getElementById('statWeekDone');
            const elAvg = document.getElementById('statAvgSpeed');
            const elOver = document.getElementById('statOverdueTotal');
            
            if(elWeek) elWeek.textContent = weekTotal;
            if(elAvg) elAvg.textContent = (weekTotal / 7).toFixed(1);
            if(elOver) elOver.textContent = userTasks.filter(t => !t.done && t.date && new Date(t.date) < new Date().setHours(0,0,0,0)).length;
        }

        // 3. อัปเดตรายการงานดอง
        const procList = document.getElementById('procrastinationList');
        if(procList) {
            const lazyTasks = userTasks
                .filter(t => !t.done && t.postponedCount > 0)
                .sort((a,b) => b.postponedCount - a.postponedCount)
                .slice(0, 3);

            if(lazyTasks.length > 0) {
                procList.innerHTML = `<ul class="corporate-list" style="margin:0;">` + 
                lazyTasks.map(t => `
                    <li style="padding: 8px 0; border-bottom: 1px solid var(--bg-body); font-size: 0.85rem;">
                        <div style="flex:1;">
                            <span style="display:block; color:var(--text-main); font-weight:500;">${t.text}</span>
                            <span style="font-size:0.75rem; color:var(--text-light);">Original due date changed</span>
                        </div>
                        <div class="badge-overdue" style="padding: 4px 8px; font-size:0.75rem; border-radius:12px;">
                            เลื่อน ${t.postponedCount} ครั้ง
                        </div>
                    </li>
                `).join('') + `</ul>`;
            } else {
                procList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--success);"><i class='bx bx-check-shield' style="font-size:2rem; margin-bottom:5px;"></i><p style="font-size:0.85rem;">Great! No procrastination detected.</p></div>`;
            }
        }
    } 

    // ============================================================
    // 🔧 EMERGENCY FIX: โค้ดซ่อมระบบกราฟและข้อมูล (วางท้ายสุดของไฟล์)
    // ============================================================
    
    // 1. ซ่อมข้อมูลงานทั้งหมด (Data Repair)
    // เช็คงานที่ "เสร็จแล้ว" แต่ไม่มี "วันที่เสร็จ" ให้เติมวันที่ปัจจุบันเข้าไป
    if(currentUser && userTasks.length > 0) {
        let fixedCount = 0;
        userTasks.forEach(t => {
            // ถ้าเสร็จแล้ว แต่ไม่มี completedDate หรือ postponeCount
            if(t.done && !t.completedDate) {
                t.completedDate = new Date().toISOString(); // เติมเวลาปัจจุบัน
                fixedCount++;
            }
            if(typeof t.postponedCount === 'undefined') t.postponedCount = 0;
        });
        
        if(fixedCount > 0) {
            saveUserTasks();
            console.log(`🔧 ซ่อมข้อมูลงานเก่าแล้ว ${fixedCount} งาน`);
        }
    }

    // 2. ทับฟังก์ชัน Toggle Task ให้มั่นใจว่าทำงานถูก 100%
    window.toggleTask = function(i) {
        userTasks[i].done = !userTasks[i].done;
        
        if(userTasks[i].done) {
            // บันทึกเวลาเมื่อกดเสร็จ
            userTasks[i].completedDate = new Date().toISOString(); 
            if(typeof playSoundSuccess === 'function') playSoundSuccess();
            showToast("ภารกิจสำเร็จ! (กราฟอัปเดตแล้ว)", "success");
        } else {
            userTasks[i].completedDate = null;
        }
        
        saveUserTasks();
        renderTasks();
        
        // บังคับอัปเดตกราฟทันที พร้อม Log ตรวจสอบ
        console.log("📊 Updating Chart... Data:", userTasks[i]);
        if(typeof updateRealAnalytics === 'function') updateRealAnalytics();
        
        if(currentUser && typeof renderProfilePro === 'function') {
            const avUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=2563eb&color=fff&bold=true`;
            renderProfilePro(avUrl);
        }
    };

    // 3. ทับฟังก์ชันวาดกราฟ (เพื่อ Debug ดูว่าข้อมูลมาไหม)
   // ✅ ฟังก์ชันอัปเดต Analytics (เวอร์ชันสมบูรณ์: กราฟ + จับงานดอง)
    window.updateRealAnalytics = function() {
        // --- ส่วนที่ 1: อัปเดตกราฟ Productivity ---
        const ctx = document.getElementById('productivityChart');
        if(ctx) { 
            const labels = [];
            const dataPoints = [];
            const today = new Date();
            
            // ดึง 7 วันย้อนหลัง
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0]; 
                
                labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
                
                // นับงานที่เสร็จ
                const count = userTasks.filter(t => 
                    t.done && 
                    t.completedDate && 
                    t.completedDate.startsWith(dateStr)
                ).length;
                
                dataPoints.push(count);
            }

            if(window.myProductivityChart) window.myProductivityChart.destroy();
            
            window.myProductivityChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tasks Done',
                        data: dataPoints,
                        backgroundColor: '#2563eb',
                        borderRadius: 4,
                        barThickness: 12
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
            
            // อัปเดตตัวเลขสรุป
            const weekTotal = dataPoints.reduce((a,b) => a+b, 0);
            const elWeek = document.getElementById('statWeekDone');
            if(elWeek) elWeek.textContent = weekTotal;
        }

        // --- ส่วนที่ 2: อัปเดต Procrastination Detector (จับงานดอง) ---
        const procList = document.getElementById('procrastinationList');
        if(procList) {
            // กรองหา: 1.ยังไม่เสร็จ (!t.done) และ 2.เคยเลื่อนมาแล้ว (postponedCount > 0)
            const lazyTasks = userTasks
                .filter(t => !t.done && t.postponedCount > 0) // <-- บรรทัดนี้สำคัญ! ถ้า done แล้วจะหายไป
                .sort((a,b) => b.postponedCount - a.postponedCount)
                .slice(0, 20);

            if(lazyTasks.length > 0) {
                procList.innerHTML = `<ul class="corporate-list" style="margin:0;">` + 
                lazyTasks.map(t => `
                    <li style="padding: 8px 0; border-bottom: 1px solid var(--bg-body); font-size: 0.85rem;">
                        <div style="flex:1;">
                            <span style="display:block; color:var(--text-main); font-weight:500;">${t.text}</span>
                            <span style="font-size:0.75rem; color:var(--text-light);">Original due date changed</span>
                        </div>
                        <div class="badge-overdue" style="padding: 4px 8px; font-size:0.75rem; border-radius:12px;">
                            เลื่อน ${t.postponedCount} ครั้ง
                        </div>
                    </li>
                `).join('') + `</ul>`;
            } else {
                procList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--success);"><i class='bx bx-check-shield' style="font-size:2rem; margin-bottom:5px;"></i><p style="font-size:0.85rem;">เยี่ยมมาก! ไม่มีงานดอง</p></div>`;
            }
        }
    }

    // ==========================================
    // 🔐 ระบบ Toggle ฟอร์มเปลี่ยนรหัสผ่าน (ใหม่)
    // ==========================================
    const btnShowPass = document.getElementById('btnShowChangePass');
    const btnCancelPass = document.getElementById('btnCancelChangePass');
    const formPassContainer = document.getElementById('changePassFormContainer');
    const btnShowPassContainer = document.getElementById('btnShowChangePassContainer');

    if(btnShowPass && formPassContainer) {
        // เมื่อกดปุ่ม "คลิกเพื่อเปลี่ยนรหัสผ่าน"
        btnShowPass.addEventListener('click', () => {
            // ซ่อนปุ่มเปิด
            btnShowPassContainer.classList.add('hidden');
            // โชว์ฟอร์ม
            formPassContainer.classList.remove('hidden');
        });
    }

    if(btnCancelPass) {
        // เมื่อกดปุ่ม "Cancel"
        btnCancelPass.addEventListener('click', () => {
            // ซ่อนฟอร์ม
            formPassContainer.classList.add('hidden');
            // โชว์ปุ่มเปิดกลับมา
            btnShowPassContainer.classList.remove('hidden');
            
            // ล้างค่าที่กรอกค้างไว้
            document.getElementById('oldPass').value = "";
            document.getElementById('newPass').value = "";
        });
    }
    
    // อัปเกรด: เมื่อเปลี่ยนรหัสสำเร็จ ให้พับเก็บฟอร์มอัตโนมัติ
    // (เราต้องไปดักจับ Event ของปุ่ม changePassBtn เดิม แล้วสั่งให้มันพับฟอร์มเก็บ)
    const realChangeBtn = document.getElementById('changePassBtn');
    if(realChangeBtn) {
        // ใช้เทคนิคเพิ่ม Listener ซ้อนเข้าไป (มันจะทำงานต่อจากอันเก่า)
        realChangeBtn.addEventListener('click', () => {
            // รอสัก 1 วิ (เผื่อโค้ดเก่าทำงานเสร็จ) แล้วค่อยเช็คว่าถ้าสำเร็จให้ปิดฟอร์ม
            setTimeout(() => {
                const oldPassVal = document.getElementById('oldPass').value;
                if(oldPassVal === "") { 
                    // ถ้าช่องว่างแปลว่าเปลี่ยนสำเร็จและถูกเคลียร์ค่าแล้ว -> ให้กดปุ่ม Cancel เพื่อพับจอเก็บ
                    if(btnCancelPass) btnCancelPass.click();
                }
            }, 1000);
        });
    }

    // ==========================================
    // 👁️ FIX: แก้ปุ่มลูกตา (Show/Hide Password) ให้ทำงานชัวร์ 100%
    // ==========================================
    setTimeout(() => {
        const eyes = document.querySelectorAll('.toggle-pass');
        eyes.forEach(eye => {
            // 1. สร้างปุ่มใหม่มาแทนอันเดิม (เพื่อล้างคำสั่งเก่าที่ซ้ำซ้อนทิ้งให้หมด)
            const newEye = eye.cloneNode(true);
            eye.parentNode.replaceChild(newEye, eye);

            // 2. ปรับ CSS ให้มั่นใจว่ากดติดง่ายๆ (อยู่บนสุด)
            newEye.style.cursor = "pointer";
            newEye.style.zIndex = "10"; 

            // 3. ใส่คำสั่งใหม่เข้าไปแค่ชุดเดียว
            newEye.addEventListener('click', function() {
                // หาช่อง Input ที่อยู่ข้างๆ มัน
                const input = this.parentElement.querySelector('input');
                
                if (input) {
                    // สลับ Text <-> Password
                    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                    input.setAttribute('type', type);
                    
                    // สลับไอคอน (ตาเปิด/ตาปิด)
                    this.classList.toggle('bx-show');
                    this.classList.toggle('bx-hide');
                }
            });
        });
        console.log(`✅ Fixed ${eyes.length} password toggles.`);
    }, 1000); // รอ 1 วินาทีให้หน้าเว็บโหลดครบก่อนค่อยแก้
    // รันกราฟทันทีตอนเปิด
    setTimeout(updateRealAnalytics, 500);
   
    initApp();
    // ...
    setupRandomQuote();
    initCalendar();
    initSettings();
    // ...
});