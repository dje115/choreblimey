import React, { createContext, useContext, useState, useEffect } from 'react'

export interface LanguageContextType {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translation keys
const translations = {
  en: {
    // Common
    'welcome': 'Welcome',
    'logout': 'Logout',
    'loading': 'Loading...',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'close': 'Close',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'parent_dashboard': 'Parent Dashboard',
    'co_parent_dashboard': 'Co-Parent Dashboard',
    'grandparent_dashboard': 'Grandparent Dashboard',
    'child_dashboard': 'Child Dashboard',
    
    // Family
    'family': 'Family',
    'children': 'Children',
    'chores': 'Chores',
    'rewards': 'Rewards',
    'settings': 'Settings',
    
    // Chores
    'active_chores': 'Active Chores',
    'completed_chores': 'Completed Chores',
    'pending_approvals': 'Pending Approvals',
    
    // Children
    'stars_earned': 'Stars Earned',
    'pocket_money': 'Pocket Money',
    'send_gift': 'Send Gift',
    
    // Roles
    'parent_admin': 'Parent Admin',
    'co_parent': 'Co-Parent',
    'grandparent': 'Grandparent',
    'uncle_aunt': 'Uncle/Aunt',
    'child': 'Child',
    
    // Landing Page
    'get_started_free': 'Get Started Free',
    'turn_chores_into_cheers': 'Turn Chores Into Cheers',
    'fun_way_to_teach': 'The fun way to teach kids about earning, saving, and smart spending!',
    'start_family_adventure': 'Start Your Family Adventure',
    'why_families_love': 'Why Families Love ChoreBlimey',
    'star_rewards_system': 'Star Rewards System',
    'pocket_money_made_fun': 'Pocket Money Made Fun',
    'flexible_gift_system': 'Flexible Gift System',
    'no_pressure_shopping': 'No Pressure Shopping',
    'real_time_updates': 'Real-Time Updates',
    'smart_learning': 'Smart Learning',
    'how_it_works': 'How ChoreBlimey Works',
    'create_chores': 'Create Chores',
    'kids_complete_earn': 'Kids Complete & Earn',
    'redeem_rewards': 'Redeem Rewards',
    'always_free_always_fun': 'Always Free, Always Fun',
    'ready_to_turn_chores': 'Ready to Turn Chores Into Cheers',
    'privacy_policy_gdpr': 'Privacy Policy & GDPR',
    'terms_conditions': 'Terms & Conditions',
    'contact_privacy': 'Contact Privacy',
    'contact_legal': 'Contact Legal',
    'made_with_love': 'Made with 💝 for happy families',
    'back_to_home': 'Back to Home',
    
    // Additional landing page keys
    'its_so_simple_even_kids_will_love_it': 'It\'s so simple, even the kids will love it!',
    'and_youll_love_the_results': 'And you\'ll love the results!',
    'you_decide_everything': 'You decide everything!',
    'no_more_nagging_needed': 'No more nagging needed!',
    'learning_has_never_been_this_fun': 'Learning has never been this fun!',
    'always_free_always_fun': 'Always Free, Always Fun',
    'choreblimey_completely_free': 'ChoreBlimey is completely free to use!',
    'supported_by_families_who_choose_gift_suggestions': 'We\'re supported by families who choose to use our gift suggestions, but',
    'youre_never_required_to_buy_anything': 'you\'re never required to buy anything',
    'how_we_keep_it_free': 'How We Keep It Free',
    'optional_gift_suggestions': 'Optional Gift Suggestions',
    'we_curate_amazing_gift_ideas': 'We curate amazing gift ideas for your kids!',
    'if_you_like_them_and_decide_to_purchase': 'If you like them and decide to purchase,',
    'we_get_small_commission': 'we get a small commission.',
    'but_you_can_always_create_own_rewards': 'But you can always create your own rewards!',
    'want_to_reward_with_extra_screen_time': 'Want to reward with "Extra screen time" or "Choose the movie tonight"?',
    'go_for_it': 'Go for it!',
    'were_here_to_help_not_control': 'We\'re here to help, not control your family.',
  },
  
  ro: {
    // Common
    'welcome': 'Bun venit',
    'logout': 'Deconectare',
    'loading': 'Se încarcă...',
    'save': 'Salvează',
    'cancel': 'Anulează',
    'delete': 'Șterge',
    'edit': 'Editează',
    'add': 'Adaugă',
    'close': 'Închide',
    
    // Dashboard
    'dashboard': 'Panou de control',
    'parent_dashboard': 'Panou Părinte',
    'co_parent_dashboard': 'Panou Co-Părinte',
    'grandparent_dashboard': 'Panou Bunic',
    'child_dashboard': 'Panou Copil',
    
    // Family
    'family': 'Familie',
    'children': 'Copii',
    'chores': 'Treburi',
    'rewards': 'Recompense',
    'settings': 'Setări',
    
    // Chores
    'active_chores': 'Treburi Active',
    'completed_chores': 'Treburi Finalizate',
    'pending_approvals': 'Aprobări în Așteptare',
    
    // Children
    'stars_earned': 'Stele Câștigate',
    'pocket_money': 'Bani de Buzunar',
    'send_gift': 'Trimite Cadou',
    
    // Roles
    'parent_admin': 'Părinte Admin',
    'co_parent': 'Co-Părinte',
    'grandparent': 'Bunic',
    'uncle_aunt': 'Unchi/Mătușă',
    'child': 'Copil',
    
    // Landing Page
    'get_started_free': 'Începe Gratuit',
    'turn_chores_into_cheers': 'Transformă Sarcinile în Bucurie',
    'fun_way_to_teach': 'Modul distractiv de a învăța copiii despre economisire, câștig și cheltuirea inteligentă a banilor!',
    'start_family_adventure': 'Începe Aventura Ta Familială',
    'why_families_love': 'De Ce Familiile Iubesc ChoreBlimey',
    'star_rewards_system': 'Sistem de Recompense cu Stele',
    'pocket_money_made_fun': 'Bani de Buzunar Făcuți Distractivi',
    'flexible_gift_system': 'Sistem de Cadouri Flexibil',
    'no_pressure_shopping': 'Cumpărături Fără Presiune',
    'real_time_updates': 'Actualizări în Timp Real',
    'smart_learning': 'Învățare Inteligentă',
    'how_it_works': 'Cum Funcționează ChoreBlimey',
    'create_chores': 'Creează Sarcini',
    'kids_complete_earn': 'Copiii Completează și Câștigă',
    'redeem_rewards': 'Răscumpără Recompensele',
    'always_free_always_fun': 'Întotdeauna Gratuit, Întotdeauna Distractiv',
    'ready_to_turn_chores': 'Gata să Transformi Sarcinile în Bucurie',
    'privacy_policy_gdpr': 'Politica de Confidențialitate și GDPR',
    'terms_conditions': 'Termeni și Condiții',
    'contact_privacy': 'Contactează Confidențialitatea',
    'contact_legal': 'Contactează Legal',
    'made_with_love': 'Făcut cu 💝 pentru familiile fericite',
    'back_to_home': 'Înapoi la Acasă',
    
    // Additional landing page keys
    'its_so_simple_even_kids_will_love_it': 'Este atât de simplu, încât chiar și copiii îl vor iubi!',
    'and_youll_love_the_results': 'Și vei iubi rezultatele!',
    'you_decide_everything': 'Tu decizi totul!',
    'no_more_nagging_needed': 'Nu mai e nevoie de sâcâială!',
    'learning_has_never_been_this_fun': 'Învățarea nu a fost niciodată atât de distractivă!',
    'always_free_always_fun': 'Întotdeauna Gratuit, Întotdeauna Distractiv',
    'choreblimey_completely_free': 'ChoreBlimey este complet gratuit de utilizat!',
    'supported_by_families_who_choose_gift_suggestions': 'Suntem susținuți de familiile care aleg să folosească sugestiile noastre de cadouri, dar',
    'youre_never_required_to_buy_anything': 'nu ești niciodată obligat să cumperi ceva',
    'how_we_keep_it_free': 'Cum Îl Păstrăm Gratuit',
    'optional_gift_suggestions': 'Sugestii de Cadouri Opționale',
    'we_curate_amazing_gift_ideas': 'Curațăm idei de cadouri uimitoare pentru copiii tăi!',
    'if_you_like_them_and_decide_to_purchase': 'Dacă îți plac și decizi să cumperi,',
    'we_get_small_commission': 'primim o mică comision.',
    'but_you_can_always_create_own_rewards': 'Dar poți crea întotdeauna propriile recompense!',
    'want_to_reward_with_extra_screen_time': 'Vrei să recompensezi cu "Timp suplimentar de ecran" sau "Alege filmul de seară"?',
    'go_for_it': 'Fă-o!',
    'were_here_to_help_not_control': 'Suntem aici să ajutăm, nu să controlăm familia ta.',
  },
  
  uk: {
    // Common
    'welcome': 'Ласкаво просимо',
    'logout': 'Вийти',
    'loading': 'Завантаження...',
    'save': 'Зберегти',
    'cancel': 'Скасувати',
    'delete': 'Видалити',
    'edit': 'Редагувати',
    'add': 'Додати',
    'close': 'Закрити',
    
    // Dashboard
    'dashboard': 'Панель керування',
    'parent_dashboard': 'Панель Батька',
    'co_parent_dashboard': 'Панель Спів-Батька',
    'grandparent_dashboard': 'Панель Дідуся',
    'child_dashboard': 'Панель Дитини',
    
    // Family
    'family': 'Сім\'я',
    'children': 'Діти',
    'chores': 'Обов\'язки',
    'rewards': 'Нагороди',
    'settings': 'Налаштування',
    
    // Chores
    'active_chores': 'Активні Обов\'язки',
    'completed_chores': 'Виконані Обов\'язки',
    'pending_approvals': 'Очікують Затвердження',
    
    // Children
    'stars_earned': 'Зірки Зароблені',
    'pocket_money': 'Кишенькові Гроші',
    'send_gift': 'Надіслати Подарунок',
    
    // Roles
    'parent_admin': 'Батько Адмін',
    'co_parent': 'Спів-Батько',
    'grandparent': 'Дідусь/Бабуся',
    'uncle_aunt': 'Дядько/Тітка',
    'child': 'Дитина',
    
    // Landing Page
    'get_started_free': 'Почніть Безкоштовно',
    'turn_chores_into_cheers': 'Перетворіть Обов\'язки на Радість',
    'fun_way_to_teach': 'Веселий спосіб навчити дітей заощадженню, заробітку та розумному витрачанню грошей!',
    'start_family_adventure': 'Почніть Вашу Сімейну Пригоду',
    'why_families_love': 'Чому Сім\'ї Люблять ChoreBlimey',
    'star_rewards_system': 'Система Нагород Зірочками',
    'pocket_money_made_fun': 'Кишенькові Гроші Зроблені Веселими',
    'flexible_gift_system': 'Гнучка Система Подарунків',
    'no_pressure_shopping': 'Покупки Без Тиску',
    'real_time_updates': 'Оновлення в Реальному Часі',
    'smart_learning': 'Розумне Навчання',
    'how_it_works': 'Як Працює ChoreBlimey',
    'create_chores': 'Створити Обов\'язки',
    'kids_complete_earn': 'Діти Виконують і Заробляють',
    'redeem_rewards': 'Обміняти Нагороди',
    'always_free_always_fun': 'Завжди Безкоштовно, Завжди Весело',
    'ready_to_turn_chores': 'Готові Перетворити Обов\'язки на Радість',
    'privacy_policy_gdpr': 'Політика Конфіденційності та GDPR',
    'terms_conditions': 'Умови та Положення',
    'contact_privacy': 'Зв\'язатися з Конфіденційністю',
    'contact_legal': 'Зв\'язатися з Юридичним',
    'made_with_love': 'Зроблено з 💝 для щасливих сімей',
    'back_to_home': 'Повернутися Додому',
  },
  
  zh: {
    // Common
    'welcome': '欢迎',
    'logout': '退出',
    'loading': '加载中...',
    'save': '保存',
    'cancel': '取消',
    'delete': '删除',
    'edit': '编辑',
    'add': '添加',
    'close': '关闭',
    
    // Dashboard
    'dashboard': '仪表板',
    'parent_dashboard': '家长仪表板',
    'co_parent_dashboard': '共同家长仪表板',
    'grandparent_dashboard': '祖父母仪表板',
    'child_dashboard': '儿童仪表板',
    
    // Family
    'family': '家庭',
    'children': '孩子',
    'chores': '家务',
    'rewards': '奖励',
    'settings': '设置',
    
    // Chores
    'active_chores': '活跃家务',
    'completed_chores': '已完成家务',
    'pending_approvals': '待批准',
    
    // Children
    'stars_earned': '获得星星',
    'pocket_money': '零花钱',
    'send_gift': '发送礼物',
    
    // Roles
    'parent_admin': '家长管理员',
    'co_parent': '共同家长',
    'grandparent': '祖父母',
    'uncle_aunt': '叔叔/阿姨',
    'child': '孩子',
    
    // Landing Page
    'get_started_free': '免费开始',
    'turn_chores_into_cheers': '将家务变成欢乐',
    'fun_way_to_teach': '教孩子们储蓄、赚钱和明智花钱的有趣方式！',
    'start_family_adventure': '开始您的家庭冒险',
    'why_families_love': '为什么家庭喜欢ChoreBlimey',
    'star_rewards_system': '星星奖励系统',
    'pocket_money_made_fun': '让零花钱变得有趣',
    'flexible_gift_system': '灵活礼品系统',
    'no_pressure_shopping': '无压力购物',
    'real_time_updates': '实时更新',
    'smart_learning': '智能学习',
    'how_it_works': 'ChoreBlimey如何工作',
    'create_chores': '创建家务',
    'kids_complete_earn': '孩子们完成并赚取',
    'redeem_rewards': '兑换奖励',
    'always_free_always_fun': '永远免费，永远有趣',
    'ready_to_turn_chores': '准备将家务变成欢乐',
    'privacy_policy_gdpr': '隐私政策和GDPR',
    'terms_conditions': '条款和条件',
    'contact_privacy': '联系隐私',
    'contact_legal': '联系法律',
    'made_with_love': '用💝为快乐家庭制作',
    'back_to_home': '返回首页',
  },
  
  fr: {
    // Common
    'welcome': 'Bienvenue',
    'logout': 'Déconnexion',
    'loading': 'Chargement...',
    'save': 'Enregistrer',
    'cancel': 'Annuler',
    'delete': 'Supprimer',
    'edit': 'Modifier',
    'add': 'Ajouter',
    'close': 'Fermer',
    
    // Dashboard
    'dashboard': 'Tableau de bord',
    'parent_dashboard': 'Tableau Parent',
    'co_parent_dashboard': 'Tableau Co-Parent',
    'grandparent_dashboard': 'Tableau Grand-parent',
    'child_dashboard': 'Tableau Enfant',
    
    // Family
    'family': 'Famille',
    'children': 'Enfants',
    'chores': 'Tâches',
    'rewards': 'Récompenses',
    'settings': 'Paramètres',
    
    // Chores
    'active_chores': 'Tâches Actives',
    'completed_chores': 'Tâches Terminées',
    'pending_approvals': 'En Attente d\'Approbation',
    
    // Children
    'stars_earned': 'Étoiles Gagnées',
    'pocket_money': 'Argent de Poche',
    'send_gift': 'Envoyer un Cadeau',
    
    // Roles
    'parent_admin': 'Parent Admin',
    'co_parent': 'Co-Parent',
    'grandparent': 'Grand-parent',
    'uncle_aunt': 'Oncle/Tante',
    'child': 'Enfant',
    
    // Landing Page
    'get_started_free': 'Commencer Gratuitement',
    'turn_chores_into_cheers': 'Transformez les Tâches en Joie',
    'fun_way_to_teach': 'La façon amusante d\'enseigner aux enfants l\'épargne, l\'économie et la gestion intelligente de l\'argent!',
    'start_family_adventure': 'Commencez Votre Aventure Familiale',
    'why_families_love': 'Pourquoi les Familles Adorent ChoreBlimey',
    'star_rewards_system': 'Système de Récompenses Étoiles',
    'pocket_money_made_fun': 'Argent de Poche Rendu Amusant',
    'flexible_gift_system': 'Système de Cadeaux Flexible',
    'no_pressure_shopping': 'Achats Sans Pression',
    'real_time_updates': 'Mises à Jour en Temps Réel',
    'smart_learning': 'Apprentissage Intelligent',
    'how_it_works': 'Comment ChoreBlimey Fonctionne',
    'create_chores': 'Créer des Tâches',
    'kids_complete_earn': 'Les Enfants Complètent et Gagnent',
    'redeem_rewards': 'Échanger les Récompenses',
    'always_free_always_fun': 'Toujours Gratuit, Toujours Amusant',
    'ready_to_turn_chores': 'Prêt à Transformer les Tâches en Joie',
    'privacy_policy_gdpr': 'Politique de Confidentialité et RGPD',
    'terms_conditions': 'Conditions Générales',
    'contact_privacy': 'Contacter Confidentialité',
    'contact_legal': 'Contacter Légal',
    'made_with_love': 'Fait avec 💝 pour les familles heureuses',
    'back_to_home': 'Retour à l\'Accueil',
  },
  
  de: {
    // Common
    'welcome': 'Willkommen',
    'logout': 'Abmelden',
    'loading': 'Laden...',
    'save': 'Speichern',
    'cancel': 'Abbrechen',
    'delete': 'Löschen',
    'edit': 'Bearbeiten',
    'add': 'Hinzufügen',
    'close': 'Schließen',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'parent_dashboard': 'Eltern Dashboard',
    'co_parent_dashboard': 'Co-Eltern Dashboard',
    'grandparent_dashboard': 'Großeltern Dashboard',
    'child_dashboard': 'Kind Dashboard',
    
    // Family
    'family': 'Familie',
    'children': 'Kinder',
    'chores': 'Aufgaben',
    'rewards': 'Belohnungen',
    'settings': 'Einstellungen',
    
    // Chores
    'active_chores': 'Aktive Aufgaben',
    'completed_chores': 'Abgeschlossene Aufgaben',
    'pending_approvals': 'Ausstehende Genehmigungen',
    
    // Children
    'stars_earned': 'Verdiente Sterne',
    'pocket_money': 'Taschengeld',
    'send_gift': 'Geschenk Senden',
    
    // Roles
    'parent_admin': 'Eltern Admin',
    'co_parent': 'Co-Eltern',
    'grandparent': 'Großeltern',
    'uncle_aunt': 'Onkel/Tante',
    'child': 'Kind',
    
    // Landing Page
    'get_started_free': 'Kostenlos Starten',
    'turn_chores_into_cheers': 'Verwandeln Sie Aufgaben in Freude',
    'fun_way_to_teach': 'Der spaßige Weg, Kindern das Sparen, Verdienen und intelligente Geldausgeben beizubringen!',
    'start_family_adventure': 'Starten Sie Ihr Familienabenteuer',
    'why_families_love': 'Warum Familien ChoreBlimey Lieben',
    'star_rewards_system': 'Stern-Belohnungssystem',
    'pocket_money_made_fun': 'Taschengeld Spaßig Gemacht',
    'flexible_gift_system': 'Flexibles Geschenksystem',
    'no_pressure_shopping': 'Kaufdruck-Freies Einkaufen',
    'real_time_updates': 'Echtzeit-Updates',
    'smart_learning': 'Intelligentes Lernen',
    'how_it_works': 'Wie ChoreBlimey Funktioniert',
    'create_chores': 'Aufgaben Erstellen',
    'kids_complete_earn': 'Kinder Erledigen und Verdienen',
    'redeem_rewards': 'Belohnungen Einlösen',
    'always_free_always_fun': 'Immer Kostenlos, Immer Spaßig',
    'ready_to_turn_chores': 'Bereit, Aufgaben in Freude zu Verwandeln',
    'privacy_policy_gdpr': 'Datenschutzrichtlinie und DSGVO',
    'terms_conditions': 'Allgemeine Geschäftsbedingungen',
    'contact_privacy': 'Datenschutz Kontaktieren',
    'contact_legal': 'Rechtliches Kontaktieren',
    'made_with_love': 'Mit 💝 für glückliche Familien gemacht',
    'back_to_home': 'Zurück zur Startseite',
  },
  
  it: {
    // Common
    'welcome': 'Benvenuto',
    'logout': 'Disconnetti',
    'loading': 'Caricamento...',
    'save': 'Salva',
    'cancel': 'Annulla',
    'delete': 'Elimina',
    'edit': 'Modifica',
    'add': 'Aggiungi',
    'close': 'Chiudi',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'parent_dashboard': 'Dashboard Genitore',
    'co_parent_dashboard': 'Dashboard Co-Genitore',
    'grandparent_dashboard': 'Dashboard Nonno',
    'child_dashboard': 'Dashboard Bambino',
    
    // Family
    'family': 'Famiglia',
    'children': 'Bambini',
    'chores': 'Lavori',
    'rewards': 'Ricompense',
    'settings': 'Impostazioni',
    
    // Chores
    'active_chores': 'Lavori Attivi',
    'completed_chores': 'Lavori Completati',
    'pending_approvals': 'Approvazioni in Sospeso',
    
    // Children
    'stars_earned': 'Stelle Guadagnate',
    'pocket_money': 'Paghetta',
    'send_gift': 'Invia Regalo',
    
    // Roles
    'parent_admin': 'Genitore Admin',
    'co_parent': 'Co-Genitore',
    'grandparent': 'Nonno',
    'uncle_aunt': 'Zio/Zia',
    'child': 'Bambino',
    
    // Landing Page
    'get_started_free': 'Inizia Gratis',
    'turn_chores_into_cheers': 'Trasforma le Faccende in Gioia',
    'fun_way_to_teach': 'Il modo divertente per insegnare ai bambini il risparmio, il guadagno e la gestione intelligente del denaro!',
    'start_family_adventure': 'Inizia la Tua Avventura Familiare',
    'why_families_love': 'Perché le Famiglie Amano ChoreBlimey',
    'star_rewards_system': 'Sistema di Ricompense a Stelle',
    'pocket_money_made_fun': 'Paghetta Resa Divertente',
    'flexible_gift_system': 'Sistema di Regali Flessibile',
    'no_pressure_shopping': 'Shopping Senza Pressione',
    'real_time_updates': 'Aggiornamenti in Tempo Reale',
    'smart_learning': 'Apprendimento Intelligente',
    'how_it_works': 'Come Funziona ChoreBlimey',
    'create_chores': 'Crea Faccende',
    'kids_complete_earn': 'I Bambini Completano e Guadagnano',
    'redeem_rewards': 'Riscatta Ricompense',
    'always_free_always_fun': 'Sempre Gratis, Sempre Divertente',
    'ready_to_turn_chores': 'Pronto a Trasformare le Faccende in Gioia',
    'privacy_policy_gdpr': 'Politica sulla Privacy e GDPR',
    'terms_conditions': 'Termini e Condizioni',
    'contact_privacy': 'Contatta Privacy',
    'contact_legal': 'Contatta Legale',
    'made_with_love': 'Fatto con 💝 per famiglie felici',
    'back_to_home': 'Torna alla Home',
  },
  
  es: {
    // Common
    'welcome': 'Bienvenido',
    'logout': 'Cerrar sesión',
    'loading': 'Cargando...',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'delete': 'Eliminar',
    'edit': 'Editar',
    'add': 'Añadir',
    'close': 'Cerrar',
    
    // Dashboard
    'dashboard': 'Panel de control',
    'parent_dashboard': 'Panel de Padres',
    'co_parent_dashboard': 'Panel de Co-Padres',
    'grandparent_dashboard': 'Panel de Abuelos',
    'child_dashboard': 'Panel de Niño',
    
    // Family
    'family': 'Familia',
    'children': 'Niños',
    'chores': 'Tareas',
    'rewards': 'Recompensas',
    'settings': 'Configuración',
    
    // Chores
    'active_chores': 'Tareas Activas',
    'completed_chores': 'Tareas Completadas',
    'pending_approvals': 'Aprobaciones Pendientes',
    
    // Children
    'stars_earned': 'Estrellas Ganadas',
    'pocket_money': 'Dinero de Bolsillo',
    'send_gift': 'Enviar Regalo',
    
    // Roles
    'parent_admin': 'Padre Admin',
    'co_parent': 'Co-Padre',
    'grandparent': 'Abuelo',
    'uncle_aunt': 'Tío/Tía',
    'child': 'Niño',
    
    // Landing Page
    'get_started_free': 'Comenzar Gratis',
    'turn_chores_into_cheers': 'Convierte las Tareas en Alegría',
    'fun_way_to_teach': '¡La forma divertida de enseñar a los niños sobre ahorrar, ganar y gastar dinero inteligentemente!',
    'start_family_adventure': 'Comienza Tu Aventura Familiar',
    'why_families_love': 'Por Qué las Familias Aman ChoreBlimey',
    'star_rewards_system': 'Sistema de Recompensas con Estrellas',
    'pocket_money_made_fun': 'Dinero de Bolsillo Hecho Divertido',
    'flexible_gift_system': 'Sistema de Regalos Flexible',
    'no_pressure_shopping': 'Compras Sin Presión',
    'real_time_updates': 'Actualizaciones en Tiempo Real',
    'smart_learning': 'Aprendizaje Inteligente',
    'how_it_works': 'Cómo Funciona ChoreBlimey',
    'create_chores': 'Crear Tareas',
    'kids_complete_earn': 'Los Niños Completan y Ganan',
    'redeem_rewards': 'Canjear Recompensas',
    'always_free_always_fun': 'Siempre Gratis, Siempre Divertido',
    'ready_to_turn_chores': 'Listo para Convertir Tareas en Alegría',
    'privacy_policy_gdpr': 'Política de Privacidad y RGPD',
    'terms_conditions': 'Términos y Condiciones',
    'contact_privacy': 'Contactar Privacidad',
    'contact_legal': 'Contactar Legal',
    'made_with_love': 'Hecho con 💝 para familias felices',
    'back_to_home': 'Volver al Inicio',
  },
  
  ar: {
    // Common
    'welcome': 'أهلاً وسهلاً',
    'logout': 'تسجيل الخروج',
    'loading': 'جاري التحميل...',
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'close': 'إغلاق',
    
    // Dashboard
    'dashboard': 'لوحة التحكم',
    'parent_dashboard': 'لوحة الآباء',
    'co_parent_dashboard': 'لوحة الوالدين المشتركين',
    'grandparent_dashboard': 'لوحة الأجداد',
    'child_dashboard': 'لوحة الطفل',
    
    // Family
    'family': 'العائلة',
    'children': 'الأطفال',
    'chores': 'المهام',
    'rewards': 'المكافآت',
    'settings': 'الإعدادات',
    
    // Chores
    'active_chores': 'المهام النشطة',
    'completed_chores': 'المهام المكتملة',
    'pending_approvals': 'في انتظار الموافقة',
    
    // Children
    'stars_earned': 'النجوم المكتسبة',
    'pocket_money': 'المصروف',
    'send_gift': 'إرسال هدية',
    
    // Roles
    'parent_admin': 'أب/أم مدير',
    'co_parent': 'والد مشترك',
    'grandparent': 'جد/جدة',
    'uncle_aunt': 'عم/خال/عمة/خالة',
    'child': 'طفل',
    
    // Landing Page
    'get_started_free': 'ابدأ مجاناً',
    'turn_chores_into_cheers': 'حول المهام إلى فرح',
    'fun_way_to_teach': 'الطريقة الممتعة لتعليم الأطفال الادخار والكسب والإنفاق الذكي للمال!',
    'start_family_adventure': 'ابدأ مغامرة عائلتك',
    'why_families_love': 'لماذا تحب العائلات ChoreBlimey',
    'star_rewards_system': 'نظام مكافآت النجوم',
    'pocket_money_made_fun': 'المصروف أصبح ممتعاً',
    'flexible_gift_system': 'نظام هدايا مرن',
    'no_pressure_shopping': 'تسوق بدون ضغط',
    'real_time_updates': 'تحديثات فورية',
    'smart_learning': 'تعلم ذكي',
    'how_it_works': 'كيف يعمل ChoreBlimey',
    'create_chores': 'إنشاء مهام',
    'kids_complete_earn': 'الأطفال يكملون ويكسبون',
    'redeem_rewards': 'استبدال المكافآت',
    'always_free_always_fun': 'دائماً مجاني، دائماً ممتع',
    'ready_to_turn_chores': 'مستعد لتحويل المهام إلى فرح',
    'privacy_policy_gdpr': 'سياسة الخصوصية وGDPR',
    'terms_conditions': 'الشروط والأحكام',
    'contact_privacy': 'اتصل بالخصوصية',
    'contact_legal': 'اتصل بالقانوني',
    'made_with_love': 'صُنع بـ💝 للعائلات السعيدة',
    'back_to_home': 'العودة للصفحة الرئيسية',
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<string>('en')

  useEffect(() => {
    // Load language from localStorage or default to 'en'
    const savedLanguage = localStorage.getItem('choreblimey_language') || 'en'
    setLanguage(savedLanguage)
  }, [])

  const handleSetLanguage = (lang: string) => {
    setLanguage(lang)
    localStorage.setItem('choreblimey_language', lang)
  }

  const t = (key: string): string => {
    const langTranslations = translations[language as keyof typeof translations] || translations.en
    return langTranslations[key as keyof typeof langTranslations] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
