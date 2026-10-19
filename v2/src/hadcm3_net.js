/* HadCM3 walkthrough v2 — component networks.
   One source for both languages. build_v2.py inlines this file into the EN and ZH pages.
   Needs dagre 0.8.5 (global `dagre`) for the layered layout.

   Each network lists nodes and edges:
     P(id, title, routine, opts)  process; opts: p [parameter names], d description,
                                  cond (runs only sometimes, dashed), off (inactive, grey), loop, fam
     V(id, label)                 variable made and used inside the component
     I(id, from, label)           variable entering from another component (or 'state', 'file')
     O(id, to, label)             variable leaving to another component (or 'state', 'stash')
   seq: call order, chains "a>b>c", branches separated by ";"
   e:   data edges, tokens "a>b" or "a,b>c,d"
   Parameter nodes are added automatically from each process's p list; their values and
   meanings come from the page's own parameter tables. */
(function () {
  'use strict';
  const L = (en, zh) => ({ en, zh });
  const P = (id, t, r, o) => Object.assign({ id, k: 'proc', t, r }, o || {});
  const V = (id, t) => ({ id, k: 'var', t });
  const I = (id, c, t) => ({ id, k: 'in', c, t });
  const O = (id, c, t) => ({ id, k: 'out', c, t });

  const RADSTEP = L('radiation steps only', '仅辐射步');
  const NONRAD = L('steps without full radiation', '仅非辐射步');
  const LOOPK = L('↻ per level k', '↻ 每层 k');
  const LOOPJ = L('↻ per row j', '↻ 每行 j');
  const TRIF = L('every TRIFFID_PERIOD', '每 TRIFFID_PERIOD');
  const STEP48 = L('step 48 only', '仅第 48 步');

  const NETS = {
    /* ------------------------------------------------------------ dynamics */
    dyn: {
      nodes: [
        I('ps', 'state', L('p*  surface pressure', 'p*  地面气压')),
        I('th', 'state', L('θ  potential temperature', 'θ  位温')),
        I('q', 'state', L('q  specific humidity', 'q  比湿')),
        I('qc', 'state', L('qcl, qcf  cloud liquid and ice', 'qcl、qcf  云中液水和冰')),
        I('uv', 'state', L('u, v  winds', 'u、v  风')),
        I('orog', 'file', L('Orography', '地形')),
        P('d1', L('Set the time steps', '设定时间步长'), 'ATM_DYN · ATMDYN1.dk:350–426',
          { p: ['STEPS_PER_PERIODim', 'A_SWEEPS_DYN', 'L_HALF_TIMESTEP_DYN', 'A_ADJSTEPS'],
            d: L('Dynamics step = 1800 s ÷ A_SWEEPS_DYN; adjustment step = that ÷ A_ADJSTEPS. With L_HALF_TIMESTEP_DYN off there is always one sweep.', '动力步长 = 1800 s ÷ A_SWEEPS_DYN；调整步长 = 再 ÷ A_ADJSTEPS。L_HALF_TIMESTEP_DYN 关闭，所以始终只扫描一次。') }),
        V('dtd', L('Δt_dyn = 1800 s', 'Δt_dyn = 1800 s')),
        V('dta', L('Δt_adj = 600 s', 'Δt_adj = 600 s')),
        P('d2', L('Polar-filter set-up', '极区滤波设置'), 'SET_FIL · ATMDYN1.dk:472',
          { p: ['A_NSET_FILTER', 'GRAV_WAVE_SPEED', 'FILTERING_SAFETY_FACTOR'],
            d: L('For each row, find the zonal wavenumbers too fast for the adjustment step.', '逐行找出对调整步长来说太快的纬向波数。') }),
        V('fw', L('Filter wavenumbers per row', '各行滤波波数')),
        P('d3', L('Adjustment', '调整'), 'ADJ_CTL · ATMDYN1.dk:656',
          { loop: L('× A_ADJSTEPS', '× A_ADJSTEPS'), p: ['A_ADJSTEPS', 'ADJ_TIME_SMOOTHING_COEFF'],
            d: L('Gravity-wave adjustment of p*, θ, u, v (pressure gradient, Coriolis); Fourier filtering at high latitudes; time smoothing across the sub-steps.', '对 p*、θ、u、v 做重力波调整（气压梯度力、科氏力）；高纬傅里叶滤波；子步之间做时间平滑。') }),
        V('adj', L('Adjusted p*, θ, u, v', '调整后的 p*、θ、u、v')),
        V('ex', L('Exner pressure', 'Exner 气压')),
        V('um', L('Time-mean mass fluxes ū and η̇', '时间平均质量通量 ū 和 η̇')),
        P('d4', L('Convert to θl and qt', '换成 θl 和 qt'), 'THETL_QT · ATMDYN1.dk:771',
          { d: L('Combine θ, q and cloud water into liquid-water potential temperature θl and total water qt, which advection conserves.', '把 θ、q 和云水合成液水位温 θl 和总水 qt，二者在平流中守恒。') }),
        V('tl', L('θl, qt', 'θl、qt')),
        P('d5', L('Advection', '平流'), 'ADV_CTL · ATMDYN1.dk:2138',
          { p: ['NU_BASIC', 'DIV_DAMP_COEFF_FC'],
            d: L('Advect mass-weighted u, v, θl, qt over the full step; add the Coriolis term from vertical motion.', '在完整步长内平流质量加权的 u、v、θl、qt；加入垂直运动引起的科氏项。') }),
        V('adv', L('Advected mass-weighted u, v, θl, qt', '平流后质量加权的 u、v、θl、qt')),
        P('d6', L('Remove mass weighting', '去掉质量加权'), 'MASS_UWT · ATMDYN1.dk:2232',
          { d: L('Divide by the layer mass to recover u, v, θl, qt.', '除以层质量，恢复 u、v、θl、qt。') }),
        V('st', L('u, v, θl, qt', 'u、v、θl、qt')),
        P('d7', L('Vertical velocity ω', '垂直速度 ω'), 'ATM_DYN §12 · ATMDYN1.dk:2269–2345',
          { d: L('ω on model levels, interpolated to pressure levels, for diagnostics.', '模式层上的 ω，插值到气压层，用于诊断。') }),
        P('d8', L('Horizontal diffusion', '水平扩散'), 'DIF_CTL · ATMDYN1.dk:2380',
          { p: ['DIFF_COEFF', 'DIFF_EXP', 'DIFF_COEFF_Q', 'DIFF_EXP_Q'],
            d: L('Scale-selective diffusion: ∇⁶ on most levels, ∇² on the top level; ∇⁴ for moisture on levels 14–18.', '尺度选择性扩散：大部分层 ∇⁶，顶层 ∇²；水汽在第 14–18 层为 ∇⁴。') }),
        P('d9', L('Remove negative humidity', '去掉负湿度'), 'QT_POS_CTL · ATMDYN1.dk:2410',
          { p: ['L_QT_POS_LOCAL'], d: L('Fill negative qt left by advection.', '补上平流留下的负 qt。') }),
        P('d10', L('Polar filtering of u, v', 'u、v 极区滤波'), 'FILT_UV · ATMDYN1.dk:2515',
          { d: L('Mass-weighted Fourier filtering and polar averaging of the wind increments.', '对风增量做质量加权的傅里叶滤波和极点平均。') }),
        O('o1', 'cloud', L('p*, θl, qt, u, v for the physics', '给物理部分的 p*、θl、qt、u、v')),
        O('o2', 'stash', L('ω on model and pressure levels', '模式层和气压层上的 ω'))
      ],
      seq: 'd1>d2>d3>d4>d5>d6>d7>d8>d9>d10',
      e: 'd1>dtd,dta dtd>d5 dta>d2,d3 d2>fw fw>d3,d10 ps,th,uv,orog>d3 d3>adj,ex,um adj>d4,d5 ex>d4 q,qc>d4 d4>tl tl>d5 um>d5,d7 d5>adv adv>d6 d6>st st>d8 ps>d7 d7>o2 d10>o1'
    },

    /* ------------------------------------------------------------ radiation */
    rad: {
      nodes: [
        P('r1', L('Is this a radiation step?', '是辐射步吗？'), 'SETTSCTL · SETTSCT1.dk:508–510',
          { p: ['A_SW_RADSTEP', 'A_LW_RADSTEP'], d: L('True when MOD(STEP − 1, 6) = 0: steps 1, 7, 13 … 43.', 'MOD(STEP − 1, 6) = 0 时为真：第 1、7、13 … 43 步。') }),
        V('sw', L('L_SW_RADIATE, L_LW_RADIATE', 'L_SW_RADIATE、L_LW_RADIATE')),
        I('date', 'state', L('Model date and time', '模式日期和时刻')),
        I('orb', 'file', L('Orbit e, γ, τ₀, sin(obliquity), set once at start-up', '轨道 e、γ、τ₀、sin(黄赤交角)，启动时设定一次')),
        I('tq', 'cloud', L('T, q after the cloud scheme', '云方案之后的 T、q')),
        I('ps', 'dyn', L('p*, Exner pressure', 'p*、Exner 气压')),
        I('lsc', 'cloud', L('Layer cloud fraction, liquid and ice water', '层状云量、液水和冰水')),
        I('cvc', 'conv', L('Convective cloud amount, base, top', '对流云量、云底、云顶')),
        I('oz', 'file', L('Ozone climatology (qrclim.ozone_CMIP7clim)', '臭氧气候态（qrclim.ozone_CMIP7clim）')),
        I('ice', 'cpl', L('Sea-ice fraction (last swap)', '海冰比例（最近一次交换）')),
        I('ts', 'bl', L('Surface temperature T*', '地表温度 T*')),
        I('snow', 'hydro', L('Snow mass', '积雪量')),
        I('lalb', 'veg', L('Albedo of the MOSES land tiles', 'MOSES 陆面 tile 反照率')),
        P('r2', L('Tropopause', '对流层顶'), 'TROPIN · RAD_CTL1.dk:757', { cond: RADSTEP, d: L('Locate the tropopause in each column.', '确定每个气柱的对流层顶。') }),
        V('trop', L('Tropopause level', '对流层顶层次')),
        P('r3', L('Sun position', '太阳位置'), 'SOLPOS · RAD_CTL1.dk:843',
          { cond: RADSTEP, p: ['L_SEC_VAR'], d: L('Solar declination and Earth–Sun distance factor for today.', '当天的太阳赤纬和日地距离因子。') }),
        V('dec', L('sin(declination), distance factor', 'sin(赤纬)、日地距离因子')),
        P('r4', L('Zenith angle over 3 h', '3 小时天顶角'), 'SOLANG · RAD_CTL1.dk:886',
          { cond: RADSTEP, p: ['A_SW_RADSTEP'], d: L('Mean cos(zenith angle) and sunlit fraction at every point over the next A_SW_RADSTEP steps.', '每个格点未来 A_SW_RADSTEP 步的平均 cos(天顶角) 和日照比例。') }),
        V('cz3', L('cos(zenith), sunlit fraction (3-h mean)', 'cos(天顶角)、日照比例（3 小时平均）')),
        P('r5', L('Surface albedo', '地表反照率'), 'FTSA · RAD_CTL1.dk:990–1026',
          { cond: RADSTEP, p: ['ALPHAC', 'ALPHAM', 'DTICE'], d: L('Albedo of open sea, of sea ice from its surface temperature, and of snow; land albedo from the tiles.', '开阔海面、海冰（由冰面温度决定）和积雪的反照率；陆面反照率来自 tile。') }),
        V('alb', L('Surface albedo', '地表反照率')),
        P('r6', L('Shortwave', '短波'), 'R2_SWRAD · RAD_CTL1.dk:1399',
          { cond: RADSTEP, p: ['H_SWBANDS', 'SC', 'CO2_MMR', 'O2MMR', 'L_CLIMAT_AEROSOL', 'A_SW_SEGMENTS'], d: L('Edwards–Slingo two-stream scheme for every sunlit point.', '对每个日照点用 Edwards–Slingo 二流方案计算。') }),
        V('swh', L('SW heating per layer, surface SW', '各层短波加热、地面短波')),
        P('r7', L('Longwave', '长波'), 'R2_LWRAD · RAD_CTL1.dk:1985',
          { cond: RADSTEP, p: ['H_LWBANDS', 'CO2_MMR', 'CH4MMR', 'N2OMMR', 'L_CLIMAT_AEROSOL', 'A_LW_SEGMENTS'], d: L('Edwards–Slingo longwave with water vapour, CO₂, CH₄, N₂O and ozone.', 'Edwards–Slingo 长波，含水汽、CO₂、CH₄、N₂O 和臭氧。') }),
        V('lwh', L('LW heating per layer, surface LW down', '各层长波加热、地面向下长波')),
        P('r8', L('Store and apply', '存下并施加'), 'BUFFOUT · RAD_CTL1.dk:1555–1660',
          { cond: RADSTEP, d: L('Save the heating for the next 5 steps (shortwave per unit sunlight) and apply it, rescaled to this step’s sun angle.', '存下供后 5 步用的加热率（短波按单位日照存），按本步太阳高度角缩放后施加。') }),
        V('inc', L('Stored increments (RADINCS)', '存下的增量（RADINCS）')),
        P('r9', L('Net flux for the energy budget', '能量收支用的净通量'), 'FLUX_DIAG · RAD_CTL1.dk:1587, 2120', { cond: RADSTEP }),
        P('r10', L('Reuse on the other steps', '其他步沿用'), 'CLD_CTL §9.1, §9.4 · CLDCTL1.dk:303–312, 750–990',
          { cond: NONRAD, d: L('Read the stored heating, rescale shortwave to this step’s zenith angle (SOLPOS, SOLANG), reapply longwave unchanged.', '读回存下的加热率，短波按本步天顶角（SOLPOS、SOLANG）重新缩放，长波原样加上。') }),
        P('r11', L('Tile surface radiation', 'tile 地表辐射'), 'RAD_MOSES · CLDCTL1.dk:978', { cond: NONRAD }),
        O('oth', 'state', L('Radiative heating → θ', '辐射加热 → θ')),
        O('osw', 'cpl', L('Surface net SW and blue SW', '地面净短波和蓝光短波')),
        O('olw', 'bl', L('Surface SW and LW down', '地面向下短波和长波')),
        O('opar', 'bl', L('Photosynthetically active radiation', '光合有效辐射')),
        O('otile', 'bl', L('Net radiation per MOSES tile', '各 MOSES tile 的净辐射')),
        O('oe', 'eng', L('Net radiative heating of the column', '气柱净辐射加热'))
      ],
      seq: 'r1>r2>r3>r4>r5>r6>r7>r8>r9; r1>r10>r11',
      e: 'r1>sw sw>r2,r10 date,orb>r3 r3>dec dec>r4,r6 r4>cz3 cz3>r6 ps,tq>r2,r6,r7 r2>trop trop>r6,r7 lsc,cvc,oz>r6,r7 ice,ts,snow,lalb>r5 r5>alb alb>r6 r6>swh r7>lwh swh,lwh>r8 r8>inc,oth,opar swh>osw lwh>olw swh,lwh>r9 r9>oe inc>r10 r10>oth,opar r11>otile'
    },

    /* ------------------------------------------------------------ cloud & large-scale precipitation */
    cloud: {
      nodes: [
        I('inc', 'rad', L('Stored radiative increments', '存下的辐射增量')),
        I('tl', 'dyn', L('θl, qt after the dynamics', '动力之后的 θl、qt')),
        I('ps', 'dyn', L('p*, Exner pressure', 'p*、Exner 气压')),
        I('lsm', 'file', L('Land–sea mask', '海陆掩膜')),
        P('c1', L('Read stored radiation', '读回存下的辐射'), 'CLD_CTL §9.1 · CLDCTL1.dk:303–312', { cond: NONRAD }),
        P('c2', L('Diagnose RHcrit', '诊断 RHcrit'), 'RHCRIT_CALC · CLDCTL1.dk:316',
          { off: true, cond: L('off: L_RHCPT = .FALSE.', '关闭：L_RHCPT = .FALSE.'), p: ['L_RHCPT'] }),
        P('c3', L('Cloud scheme', '云方案'), 'GLUE_CLD → LS_CLD · CLDCTL1.dk:347',
          { p: ['RHCRIT', 'L_LSPICE'], d: L('Split qt and θl into q, T, cloud liquid and ice, assuming a sub-grid spread of humidity set by RHcrit; liquid/ice split by temperature.', '假定宽度由 RHcrit 决定的次网格湿度分布，把 qt、θl 拆成 q、T、云中液水和冰；液/冰按温度划分。') }),
        P('c4', L('Area cloud fraction', '面积云量'), 'AREA_CLD · CLDCTL1.dk:339',
          { off: true, cond: L('off: L_CLD_AREA = .FALSE.', '关闭：L_CLD_AREA = .FALSE.'), p: ['L_CLD_AREA'] }),
        V('tq', L('T, q', 'T、q')),
        V('qcl', L('qcl, qcf  cloud liquid and ice', 'qcl、qcf  云中液水和冰')),
        V('cf', L('Layer cloud fraction', '层状云量')),
        P('c5', L('Cloud-cover diagnostics', '云覆盖诊断'), 'CLOUD_COVER · CLDCTL1.dk:454', { d: L('Total and layer cloud cover.', '总云量和分层云量。') }),
        P('c6', L('Reapply radiation', '加回辐射'), 'CLD_CTL §9.4 · CLDCTL1.dk:750–990', { cond: NONRAD }),
        P('c7', L('Large-scale precipitation', '大尺度降水'), 'GLUE_LSPP → LS_PPN · LSPP_CT1.dk:221',
          { p: ['CW_SEA', 'CW_LAND', 'RHCRIT', 'L_LSPICE'], d: L('From the top down: ice fall-out, autoconversion of cloud liquid above a threshold (higher over land), evaporation of rain and snow below cloud.', '自上而下：冰晶下落、云中液水超过阈值后自动转化（陆地阈值更高）、云下雨雪蒸发。') }),
        P('c8', L('Precipitation flux sum', '降水通量累计'), 'FLUX_DIAG · LSPP_CT1.dk:306'),
        O('occ', 'stash', L('Total and layer cloud cover', '总云量和分层云量')),
        O('ocf', 'rad', L('Cloud fraction, liquid and ice water', '云量、液水和冰水')),
        O('oth', 'state', L('θ, q after cloud, radiation and precipitation', '云、辐射和降水之后的 θ、q')),
        O('orain', 'hydro', L('LS rain and snow on land', '陆地上的大尺度雨和雪')),
        O('ocpl', 'cpl', L('LS rain and snow over the sea', '海上的大尺度雨和雪')),
        O('oe', 'eng', L('Latent heat of LS precipitation', '大尺度降水潜热'))
      ],
      seq: 'c1>c2>c3>c4>c5>c6>c7>c8',
      e: 'inc>c1 c1>c6 tl,ps>c3 c3>tq,qcl,cf cf>c5,ocf,c7 qcl>ocf,c7 c5>occ tq>c6,c7 c6>oth ps,lsm>c7 c7>oth,orain,ocpl c8>oe'
    },

    /* ------------------------------------------------------------ convection */
    conv: {
      nodes: [
        I('tq', 'bl', L('θ, q after BL and LS precipitation', '经边界层和大尺度降水后的 θ、q')),
        I('uv', 'bl', L('u, v', 'u、v')),
        I('ps', 'dyn', L('p*, Exner pressure', 'p*、Exner 气压')),
        I('fl', 'bl', L('T₁, q₁ fluctuations', 'T₁、q₁ 扰动')),
        P('v1', L('Is convection due?', '该做对流了吗？'), 'SETTSCTL · SETTSCT1.dk:512', { p: ['A_CONV_STEP'] }),
        P('v2', L('Split into segments', '分块'), 'CONV_CTL → GLUE_CONV · CONV_CT1.dk:585', { p: ['A_CONVECT_SEGMENTS'] }),
        P('v3', L('Column set-up', '气柱准备'), 'QSAT · FLAG_WET · CONVEC3C.dk:633–664',
          { p: ['L_MOM'], d: L('Saturation humidity on every level; water or ice condensate; initial parcel momentum.', '各层饱和比湿；凝结物为水或冰；气块初始动量。') }),
        V('qs', L('Saturation humidity per level', '各层饱和比湿')),
        V('wi', L('Water/ice flag per level', '各层水/冰标志')),
        P('v4', L('Initiation test', '触发检验'), 'LAYER_CN · DQS_DTH · CONVEC3C.dk:797–907',
          { loop: LOOPK, d: L('Entrainment and detrainment rates; start a parcel where layer k to k + 1 is unstable enough.', '卷入、卷出率；在从 k 到 k + 1 足够不稳定处启动气块。') }),
        V('ent', L('Entrainment, detrainment rates', '卷入、卷出率')),
        V('par0', L('Initial parcel θp, qp, up, vp and mass flux', '初始气块 θp、qp、up、vp 和质量通量')),
        P('v5', L('Lift the parcel', '抬升气块'), 'LIFT_PAR · CONVEC3C.dk:1198–1434',
          { loop: LOOPK, p: ['L_MOM'], d: L('Lift from k to k + 1 with entrainment; test buoyancy; non-buoyant points detrain.', '带卷入地从 k 抬到 k + 1；检验浮力；无浮力的点卷出。') }),
        V('buoy', L('Parcel buoyancy in k + 1', 'k + 1 层气块浮力')),
        P('v6', L('Cloud and its effect', '云及其作用'), 'CONVEC2 · CONVEC3C.dk:1809',
          { loop: LOOPK, p: ['MPARWTR', 'UD_FACTOR', 'L_CCW', 'L_MOM'], d: L('Condensation and precipitation, cloud water, forced detrainment, mass-flux increments.', '凝结与降水、云水、强迫卷出、质量通量增量。') }),
        V('prec', L('Updraught precipitation', '上升气流降水')),
        V('ccw', L('Convective cloud water', '对流云水')),
        V('dth', L('dθ/dt, dq/dt, du/dt, dv/dt', 'dθ/dt、dq/dt、du/dt、dv/dt')),
        P('v7', L('Closure and downdraught', '闭合与下沉气流'), 'DD_CALL · CONVEC3C.dk:1990–2098',
          { loop: LOOPK, p: ['L_CAPE', 'L_PHASE_LIM'], d: L('For clouds ending at this level: cloud-base mass flux, downdraught, evaporation of falling precipitation.', '对在本层终止的云：云底质量通量、下沉气流、降水下落蒸发。') }),
        V('evap', L('Downdraught and evaporation increments', '下沉气流和蒸发增量')),
        P('v8', L('Energy balance', '能量平衡'), 'COR_ENGY · CONVEC3C.dk:2190', { d: L('Correct temperatures so the column conserves moist static energy.', '订正温度，使气柱湿静力能守恒。') }),
        V('cca', L('Convective cloud amount, base, top', '对流云量、云底、云顶')),
        P('v9', L('3-D convective cloud', '三维对流云'), 'CALC_3D_CCA · CONVEC3C.dk:2194',
          { off: true, cond: L('off: L_3D_CCA = .FALSE.', '关闭：L_3D_CCA = .FALSE.'), p: ['L_3D_CCA', 'ANVIL_FACTOR', 'TOWER_FACTOR'] }),
        P('v10', L('Apply increments', '施加增量'), 'CONV_CTL · CONV_CT1.dk:659'),
        P('v11', L('Precipitation flux sum', '降水通量累计'), 'FLUX_DIAG · CONV_CT1.dk:1188'),
        O('ost', 'state', L('θ, q, u, v after convection', '对流之后的 θ、q、u、v')),
        O('or', 'hydro', L('Convective rain and snow on land', '陆地上的对流雨、雪')),
        O('orc', 'cpl', L('Convective rain and snow over the sea', '海上的对流雨、雪')),
        O('occ', 'rad', L('Convective cloud amount, base, top', '对流云量、云底、云顶')),
        O('oe', 'eng', L('Latent heat of convective precipitation', '对流降水潜热'))
      ],
      seq: 'v1>v2>v3>v4>v5>v6>v7>v8>v9>v10>v11',
      e: 'tq,ps>v3,v4 uv>v3 tq>v5 v3>qs,wi qs>v4,v5 wi>v5,v6 fl>v4 v4>ent,par0 ent>v5,v6 par0>v5 v5>buoy buoy>v6 v6>prec,ccw,dth ccw>cca prec>v7 v7>evap evap,dth>v8 v8>v10 cca>v9,occ prec,evap>v10 v10>ost,or,orc v10>v11 v11>oe'
    },

    /* ------------------------------------------------------------ boundary layer */
    bl: {
      nodes: [
        I('frac', 'veg', L('Surface-type fractions (9 tiles)', '地表类型比例（9 种 tile）')),
        I('spar', 'veg', L('LAI, canopy height, tile albedo and roughness', '叶面积、冠层高度、tile 反照率和粗糙度')),
        I('par', 'rad', L('Photosynthetically active radiation', '光合有效辐射')),
        I('rad', 'rad', L('Surface SW and LW, net radiation per tile', '地面短波和长波、各 tile 净辐射')),
        I('smc', 'hydro', L('Soil moisture', '土壤水分')),
        I('tsoil', 'hydro', L('Soil temperature, snow, canopy water', '土壤温度、积雪、冠层水')),
        I('sst', 'cpl', L('SST, ice fraction, ice depth (last swap)', 'SST、海冰比例、冰厚（最近一次交换）')),
        I('oro', 'file', L('Sub-grid orography (silhouette)', '次网格地形（剖面）')),
        I('atm', 'cloud', L('T, q, u, v profiles; p*', 'T、q、u、v 廓线；p*')),
        P('b1', L('Tile lists', 'tile 列表'), 'TILEPTS · BL_IC7A.dk:667', { p: ['LMOSES'] }),
        V('tp', L('Points of each surface type', '各地表类型的点')),
        P('b2', L('Plant physiology', '植物生理'), 'PHYSIOL · BL_IC7A.dk:686',
          { p: ['CO2_MMR', 'L_CO2_INTERACTIVE'], d: L('Stomatal conductance, photosynthesis and respiration of the 5 plant types.', '5 种植物功能型的气孔导度、光合与呼吸。') }),
        V('gs', L('Stomatal conductance', '气孔导度')),
        P('b3', L('Layers and buoyancy', '层厚与浮力'), 'Z · BOUY_TQ · BDYLYR7A.dk:605–757'),
        V('bq', L('Layer depths, buoyancy parameters', '层厚、浮力参数')),
        P('b4', L('Surface exchange', '地表交换'), 'SF_EXCH · BDYLYR7A.dk:770',
          { p: ['L_Z0_OROG'], d: L('Roughness (with orographic part), bulk Richardson number, exchange coefficients and explicit fluxes for sea, sea ice and each land tile.', '海面、海冰和每个陆面 tile 的粗糙度（含地形部分）、整体 Richardson 数、交换系数和显式通量。') }),
        V('ch', L('Exchange coefficients CD, CH per tile', '各 tile 交换系数 CD、CH')),
        V('xf', L('Explicit surface fluxes per tile', '各 tile 显式地表通量')),
        P('b5', L('Mixing coefficients', '混合系数'), 'KMKH · BDYLYR7A.dk:825', { p: ['BL_LEVELS'] }),
        V('k', L('Km, Kh on the lowest levels', '最低几层的 Km、Kh')),
        P('b6', L('Explicit fluxes', '显式通量'), 'EX_FLUX_TQ · EX_FLUX_UV · BDYLYR7A.dk:917–933', { p: ['BL_LEVELS'] }),
        P('b7', L('Implicit solve for T, q', 'T、q 隐式求解'), 'IM_CAL_TQ · BDYLYR7A.dk:970', { p: ['BL_LEVELS'] }),
        V('tstar', L('Surface temperature per tile', '各 tile 地表温度')),
        P('b8', L('Sea-ice heat flux', '海冰热通量'), 'SICE_HTF · BDYLYR7A.dk:1010', { d: L('Conduction through the ice from its surface temperature and depth.', '由冰面温度和冰厚算穿过冰层的热传导。') }),
        P('b9', L('Evaporation limits', '蒸发限制'), 'SF_EVAP · BDYLYR7A.dk:1061'),
        V('ev', L('Evaporation from canopy, soil, lakes; sublimation', '冠层、土壤、湖泊蒸发；升华')),
        P('b10', L('Snowmelt', '融雪'), 'SF_MELT · BDYLYR7A.dk:1075'),
        P('b11', L('Screen-level T, q', '屏蔽高度 T、q'), 'SCREEN_TQ · BDYLYR7A.dk:1088'),
        P('b12', L('Implicit solve for u, v', 'u、v 隐式求解'), 'IM_CAL_UV · BDYLYR7A.dk:1166'),
        V('tau', L('Surface wind stress τx, τy', '地面风应力 τx、τy')),
        P('b13', L('Re-diagnose cloud', '重新诊断云'), 'GLUE_CLD · BL_CTL1.dk:1724'),
        P('b14', L('Sensible-heat flux sum', '感热通量累计'), 'FLUX_DIAG · BL_CTL1.dk:1663'),
        O('onpp', 'veg', L('GPP, NPP, respiration, leaf turnover', 'GPP、NPP、呼吸、落叶')),
        O('owme', 'cpl', L('Wind-mixing energy', '风混合能')),
        O('oice', 'cpl', L('Conductive and top-melt heat flux', '传导和顶部融化热通量')),
        O('ohyd', 'hydro', L('Snowmelt, sublimation, transpiration, soil evaporation, surface heat flux', '融雪、升华、蒸腾、土壤蒸发、地表热通量')),
        O('ocpl', 'cpl', L('τx, τy, sensible heat, evaporation', 'τx、τy、感热、蒸发')),
        O('oconv', 'conv', L('T₁, q₁ fluctuations', 'T₁、q₁ 扰动')),
        O('oscr', 'stash', L('1.5 m temperature and humidity', '1.5 m 温度和湿度')),
        O('ost', 'state', L('T, q, u, v after mixing; cloud', '混合后的 T、q、u、v；云')),
        O('oe', 'eng', L('Surface sensible heat', '地表感热'))
      ],
      seq: 'b1>b2>b3>b4>b5>b6>b7>b8>b9>b10>b11>b12>b13>b14',
      e: 'frac>b1 b1>tp tp>b2,b4,b9 par,smc,spar>b2 b2>gs,onpp gs>b4 atm>b3,b4,b7,b12 b3>bq bq>b4,b5 rad,sst,tsoil,oro,spar>b4 b4>ch,xf,owme ch>b5,b6,b11 b5>k k>b6,b7,b12 xf>b6 b7>tstar,oconv,ost tstar>b8,b9,b10,b11 sst>b8 b8>oice smc>b9 b9>ev ev>ohyd,ocpl b10>ohyd b11>oscr b12>tau tau>ocpl b12,b13>ost b7>b14 b14>oe'
    },

    /* ------------------------------------------------------------ land hydrology */
    hydro: {
      nodes: [
        I('soil', 'file', L('Soil properties (qrparm.soil.MOSES2)', '土壤属性（qrparm.soil.MOSES2）')),
        I('smst', 'state', L('Soil moisture and frozen fraction per layer', '各层土壤水分和冻结比例')),
        I('tst', 'state', L('Soil temperature per layer', '各层土壤温度')),
        I('sn', 'state', L('Snow mass, canopy water', '积雪量、冠层水')),
        I('snf', 'cloud', L('LS snowfall', '大尺度降雪')),
        I('snc', 'conv', L('Convective snowfall', '对流降雪')),
        I('rnf', 'cloud', L('LS rainfall', '大尺度降雨')),
        I('rnc', 'conv', L('Convective rainfall', '对流降雨')),
        I('blf', 'bl', L('Snowmelt, sublimation, canopy and soil evaporation, transpiration', '融雪、升华、冠层和土壤蒸发、蒸腾')),
        I('hf', 'bl', L('Surface heat flux into the soil', '进入土壤的地表热通量')),
        I('tile', 'veg', L('Tile fractions, canopy water capacity', 'tile 比例、冠层持水量')),
        P('h1', L('Soil thermal conductivity', '土壤导热率'), 'HEAT_CON · HYDROL7A.dk:210', { p: ['ST_LEVELS'] }),
        V('hc', L('Thermal conductivity per layer', '各层导热率')),
        P('h2', L('Snow', '积雪'), 'SFSNOW · HYDROL7A.dk:215', { d: L('Add snowfall, remove melt and sublimation.', '加上降雪，减去融化和升华。') }),
        P('h3', L('Canopy and surface runoff', '冠层和地表径流'), 'SURF_HYD · HYDROL7A.dk:244',
          { p: ['L_VEG_FRACS'], d: L('Interception and throughfall on each tile; water the soil cannot take runs off.', '每个 tile 上的截留和穿透降水；土壤吸收不了的水形成径流。') }),
        V('tf', L('Throughfall, infiltration', '穿透降水、下渗')),
        P('h4', L('Soil water', '土壤水'), 'SOIL_HYD · HYDROL7A.dk:254',
          { p: ['SM_LEVELS'], d: L('Flow between layers, root extraction, drainage from the bottom layer.', '层间水流、根系吸水、最底层排水。') }),
        V('wf', L('Water fluxes between layers', '层间水通量')),
        P('h5', L('Soil temperature', '土壤温度'), 'SOIL_HTC · ICE_HTC · HYDROL7A.dk:263–273', { p: ['ST_LEVELS'] }),
        P('h6', L('Soil moisture totals', '土壤水分合计'), 'SOILMC · HYDROL7A.dk:286'),
        O('ofast', 'cpl', L('Fast (surface) runoff', '快速（地表）径流')),
        O('oslow', 'cpl', L('Slow (sub-surface) runoff', '慢速（地下）径流')),
        O('obl', 'bl', L('Soil moisture, soil temperature, snow, canopy water', '土壤水分、土壤温度、积雪、冠层水')),
        O('osnow', 'rad', L('Snow mass (albedo)', '积雪量（反照率）')),
        O('odiag', 'stash', L('Column soil moisture', '整柱土壤水分'))
      ],
      seq: 'h1>h2>h3>h4>h5>h6',
      e: 'soil>h1,h4,h5 smst>h1,h4 h1>hc hc>h5 sn>h2,h3 snf,snc,blf>h2 rnf,rnc,blf,tile>h3 h3>tf,ofast tf>h4 blf>h4 h4>wf,oslow wf>h5 hf,tst>h5 h2>osnow,obl h4,h5>obl h6>odiag'
    },

    /* ------------------------------------------------------------ vegetation */
    veg: {
      nodes: [
        I('cnt', 'state', L('Steps since the last TRIFFID call', '距上次 TRIFFID 的步数')),
        I('acc', 'bl', L('Accumulated NPP, plant and soil respiration, leaf turnover', '累积的 NPP、植物和土壤呼吸、落叶')),
        I('vc', 'state', L('Vegetation carbon, soil carbon, fractions', '植被碳、土壤碳、比例')),
        I('dist', 'file', L('Disturbed fraction (qrfrac.disturb.nodisturb)', '被扰动比例（qrfrac.disturb.nodisturb）')),
        I('salb', 'file', L('Soil albedo', '土壤反照率')),
        P('g1', L('Count steps', '计步'), 'ATM_PHYS · ATMPHY1.dk:1229'),
        P('g2', L('Leaf phenology', '叶物候'), 'PHENOL · VEG2A.dk:344',
          { cond: L('every PHENOL_PERIOD', '每 PHENOL_PERIOD'), p: ['L_PHENOL', 'PHENOL_PERIOD'], d: L('Leaf turnover from temperature; update leaf area.', '由温度得到落叶率，更新叶面积。') }),
        V('lai', L('Leaf area index per plant type', '各植物功能型叶面积指数')),
        P('g3', L('Mean fluxes', '平均通量'), 'VEG · VEG2A.dk:375–410', { cond: TRIF, p: ['L_TRIFFID', 'TRIFFID_PERIOD'] }),
        V('mf', L('Mean NPP, respiration, leaf turnover over the period', '这段时间的平均 NPP、呼吸、落叶')),
        P('g4', L('Disturbance', '扰动'), 'VEG · VEG2A.dk:422', { cond: TRIF }),
        V('gan', L('Disturbance rate (zero here)', '扰动率（此处为零）')),
        P('g5', L('TRIFFID', 'TRIFFID'), 'TRIFFID · VEG2A.dk:457',
          { cond: TRIF, p: ['L_TRIF_EQ'], d: L('Carbon balance of each plant type, competition for space (Lotka–Volterra), litter into soil carbon.', '各植物功能型碳收支、空间竞争（Lotka–Volterra）、凋落物进入土壤碳。') }),
        V('nf', L('New fractions; vegetation and soil carbon', '新比例；植被碳和土壤碳')),
        P('g6', L('Update tiles', '更新 tile'), 'TILEPTS · VEG2A.dk:469', { cond: TRIF }),
        P('g7', L('Surface parameters', '地表参数'), 'SPARM · VEG2A.dk:508',
          { d: L('Albedo, roughness and canopy water capacity of each tile from leaf area and canopy height.', '由叶面积和冠层高度得到每个 tile 的反照率、粗糙度和冠层持水量。') }),
        O('ofrac', 'bl', L('Tile fractions', 'tile 比例')),
        O('osp', 'bl', L('Tile albedo, roughness, LAI, canopy height', 'tile 反照率、粗糙度、叶面积、冠层高度')),
        O('orad', 'rad', L('Land surface albedo', '陆面反照率')),
        O('ohyd', 'hydro', L('Tile fractions, canopy water capacity', 'tile 比例、冠层持水量')),
        O('ost', 'state', L('Vegetation and soil carbon', '植被碳和土壤碳'))
      ],
      seq: 'g1>g2>g3>g4>g5>g6>g7',
      e: 'cnt>g1 g1>g3 acc>g2,g3 g2>lai lai>g5,g7 g3>mf mf>g5 dist>g4 g4>gan gan>g5 vc>g5 g5>nf nf>g6,ost g6>ofrac,ohyd salb>g7 g7>osp,orad,ohyd'
    },

    /* ------------------------------------------------------------ gravity-wave drag */
    gwd: {
      nodes: [
        I('uv', 'bl', L('u, v after the boundary layer', '边界层之后的 u、v')),
        I('th', 'state', L('θ, q profiles; p*', 'θ、q 廓线；p*')),
        I('sd', 'file', L('Sub-grid orography statistics (qrparm.orog)', '次网格地形统计量（qrparm.orog）')),
        P('w1', L('Winds to pressure points', '风插到气压点'), 'UV_TO_P · GWAVE3A.dk:262'),
        V('up', L('u, v at land pressure points', '陆地气压点上的 u、v')),
        P('w2', L('Surface stress', '地面应力'), 'GW_SURF · GWAVE3A.dk:319', { p: ['KAY_GWAVE'] }),
        V('s0', L('Surface stress Sx, Sy', '地面应力 Sx、Sy')),
        P('w3', L('Vertical distribution', '垂直分布'), 'GW_VERT · GWAVE3A.dk:330',
          { p: ['START_LEVEL_GWDRAG', 'KAY_LEE_GWAVE', 'KAY_GWAVE'], d: L('Deposit the stress where the wave saturates, from START_LEVEL_GWDRAG up; add hydraulic-jump and trapped lee-wave drag.', '从 START_LEVEL_GWDRAG 层往上，在波饱和处释放应力；加上水跃和陷波拖曳。') }),
        V('sat', L('Drag from wave saturation', '波饱和拖曳')),
        V('jump', L('Drag from hydraulic jump', '水跃拖曳')),
        V('lee', L('Drag from trapped lee waves', '陷波拖曳')),
        P('w4', L('Apply to the winds', '作用到风上'), 'P_TO_UV · GWAVE3A.dk:347–369'),
        O('ouv', 'state', L('u, v after drag', '拖曳之后的 u、v')),
        O('od', 'stash', L('Stress profiles, drag by mechanism', '应力廓线、各机制拖曳'))
      ],
      seq: 'w1>w2>w3>w4',
      e: 'uv>w1 w1>up up>w2,w3 th,sd>w2,w3 w2>s0 s0>w3 w3>sat,jump,lee,od sat,jump,lee>w4 w4>ouv'
    },

    /* ------------------------------------------------------------ energy correction */
    eng: {
      nodes: [
        I('rate', 'state', L('Correction rate from the previous day', '前一天算出的订正率')),
        I('e0', 'state', L('Total energy at the start of the day', '当天开始时的总能量')),
        I('rad', 'rad', L('Net radiative heating', '净辐射加热')),
        I('lsp', 'cloud', L('Latent heat of LS rain and snow', '大尺度雨雪潜热')),
        I('cv', 'conv', L('Latent heat of convective rain and snow', '对流雨雪潜热')),
        I('sh', 'bl', L('Surface sensible heat', '地表感热')),
        I('st', 'state', L('θ, u, v, p* at the end of the day', '当天结束时的 θ、u、v、p*')),
        P('e1', L('Reset the daily sum', '当日累计清零'), 'ATM_PHYS · ATMPHY1.dk:470–477',
          { cond: L('first step of each day', '每天第一步'), p: ['LEMCORR', 'A_ENERGYSTEPS'] }),
        P('e2', L('Apply the correction', '施加订正'), 'ADD_ENG_CORR · ATMPHY1.dk:485', { p: ['LEMCORR'] }),
        P('e3', L('Accumulate the net flux', '累计净通量'), 'FLUX_DIAG · RAD_CTL, LSPP_CTL, CONV_CTL, BL_CTL'),
        V('nf', L('Net-flux field, summed over the day', '净通量场，全天累计')),
        P('e4', L('Total energy and mass', '总能量和质量'), 'ENG_MASS_DIAG · ATMPHY1.dk:1338', { cond: STEP48, p: ['A_ENERGYSTEPS'] }),
        V('en', L('Total energy and mass now', '此刻的总能量和质量')),
        P('e5', L('Global sum of the flux', '通量全球求和'), 'DO_SUMS · ATMPHY1.dk:1359', { cond: STEP48 }),
        V('gs', L('Global net energy input', '全球净能量输入')),
        P('e6', L('Correction and mass fix', '订正与质量修正'), 'CAL_ENG_MASS_CORR · ATMPHY1.dk:1361',
          { cond: STEP48, d: L('Energy change minus net input is the error; spread it as tomorrow’s heating rate; correct p* for dry-mass drift.', '能量变化减去净输入即误差；把它换成明天的加热率；修正 p* 的干空气质量漂移。') }),
        O('oth', 'state', L('θ + rate × 1800 s, every step', 'θ + 订正率 × 1800 s，每步')),
        O('orate', 'state', L('Tomorrow’s correction rate', '明天的订正率')),
        O('ops', 'state', L('p* corrected for dry-mass drift', '修正干空气质量漂移后的 p*')),
        O('oen', 'state', L('Total energy, kept for tomorrow', '总能量，留到明天比较'))
      ],
      seq: 'e1>e2>e3>e4>e5>e6',
      e: 'e1>nf rate>e2 e2>oth rad,lsp,cv,sh>e3 e3>nf nf>e5 st>e4 e4>en en,e0>e6 e5>gs gs>e6 e6>orate,ops,oen'
    },

    /* ------------------------------------------------------------ coupler */
    cpl: {
      nodes: [
        I('atau', 'bl', L('τx, τy; wind-mixing energy', 'τx、τy；风混合能')),
        I('asw', 'rad', L('Net SW, blue SW', '净短波、蓝光短波')),
        I('alw', 'rad', L('Net LW at the surface', '地面净长波')),
        I('ash', 'bl', L('Sensible heat, evaporation, sublimation', '感热、蒸发、升华')),
        I('aice', 'bl', L('Top melt, conductive heat flux, ice fraction', '顶部融化、传导热通量、海冰比例')),
        I('apr', 'cloud', L('LS rain and snow', '大尺度雨、雪')),
        I('acv', 'conv', L('Convective rain and snow', '对流雨、雪')),
        I('aro', 'hydro', L('Fast and slow runoff', '快速与慢速径流')),
        I('oce', 'file', L('River entry points on the coast (OCENTPTS)', '海岸上的河流入海点（OCENTPTS）')),
        I('osst', 'ocn', L('SST, surface currents', 'SST、表层流')),
        I('oice', 'ice', L('Ice fraction, ice depth, snow depth', '海冰比例、冰厚、雪深')),
        P('k1', L('Group length', '组长度'), 'INITTIME · INITTIM1.dk:581', { p: ['MODEL_HRS_PER_GROUP', 'STEPS_PER_PERIODim'] }),
        V('grp', L('48 atmosphere / 24 ocean steps', '48 个大气步 / 24 个海洋步')),
        P('k2', L('Daily means', '日平均'), 'STASH (tag 10) · INITA2O1.dk', { cond: L('every atmosphere step', '每个大气步') }),
        V('dm', L('Daily means on the atmosphere grid', '大气网格上的日平均量')),
        P('k3', L('Switch to the ocean', '切换到海洋'), 'SETGRCTL · SETGRCT1.dk:120–140'),
        P('k4', L('Gather; route runoff', '收集；分配径流'), 'SWAP_A2O · SWAPA2O2.dk:205–428', { p: ['L_CO2_INTERACTIVE'] }),
        V('rr', L('Runoff at the river entry points', '入海点上的径流')),
        P('k5', L('Interpolation weights', '插值权重'), 'H_INT_CO · COAST_AJ · TRANA2O1.dk:349–469'),
        V('w', L('Bilinear weights with coastal adjustment', '含海岸调整的双线性权重')),
        P('k6', L('Interpolate and combine', '插值与合成'), 'H_INT_BL · POST_H_INT · TRANA2O1.dk:381–760',
          { d: L('Sections: wind stress, wind mixing, blue SW, non-penetrating heat flux, P − E, river outflow, snowfall, sublimation, ice heat fluxes.', '各部分：风应力、风混合、蓝光、非穿透热通量、P − E、河流入海、降雪、升华、海冰热通量。') }),
        V('of', L('Fields on the 288 × 144 ocean grid', '288 × 144 海洋网格上的场')),
        P('k7', L('Scatter to the ocean', '分发给海洋'), 'SCATTER_FIELD · SWAPA2O2.dk:556–694'),
        P('k8', L('Ocean runs its day', '海洋跑完这一天'), 'OCN_STEP × 24 · U_MODEL1.dk:994'),
        P('k9', L('Gather ocean fields', '收集海洋场'), 'SWAP_O2A · SWAPO2A2.dk'),
        P('k10', L('Area-average to the atmosphere grid', '面积平均到大气网格'), 'PRE_AREAVER · DO_AREAVER · TRANO2A1.dk'),
        O('toocn', 'ocn', L('τx, τy, wind mixing, blue SW, heat flux, P − E, river outflow', 'τx、τy、风混合、蓝光、热通量、P − E、河流入海')),
        O('toice', 'ice', L('Snowfall, sublimation, top melt, conductive heat flux', '降雪、升华、顶部融化、传导热通量')),
        O('toatm', 'bl', L('T*, ice fraction, ice depth, snow depth, currents (day n + 1)', 'T*、海冰比例、冰厚、雪深、洋流（第 n + 1 天）'))
      ],
      seq: 'k1>k2>k3>k4>k5>k6>k7>k8>k9>k10',
      e: 'k1>grp grp>k2,k3 atau,asw,alw,ash,aice,apr,acv,aro>k2 k2>dm dm>k4,k6 oce>k4 k4>rr rr>k6 k5>w w>k6 k6>of of>k7 k7>toocn,toice osst,oice>k9 k10>toatm'
    },

    /* ------------------------------------------------------------ ocean */
    ocn: {
      nodes: [
        I('ts', 'state', L('T, S at two time levels', '两个时间层上的 T、S')),
        I('uv', 'state', L('Baroclinic u, v; streamfunction ψ', '斜压 u、v；流函数 ψ')),
        I('tau', 'cpl', L('Wind stress τx, τy', '风应力 τx、τy')),
        I('hf', 'cpl', L('Non-penetrating heat flux', '非穿透热通量')),
        I('pe', 'cpl', L('P − E, river outflow, snowfall', 'P − E、河流入海、降雪')),
        I('blue', 'cpl', L('Blue (penetrating) SW', '蓝光（穿透）短波')),
        I('wme', 'cpl', L('Wind-mixing energy', '风混合能')),
        I('wfix', 'file', L('Water fix (qrparm.waterfix.hadcm3)', 'water fix（qrparm.waterfix.hadcm3）')),
        I('icef', 'ice', L('Ice cover; heat and salt from the ice', '海冰覆盖；海冰带来的热量和盐分')),
        P('n1', L('Step bookkeeping', '计步'), 'OCN_FRST · OCN_FRST.dk:60', { p: ['NMIX'] }),
        V('mix', L('MIX flag: Euler-backward or leapfrog', 'MIX 标志：Euler 后差或蛙跳')),
        P('n2', L('Density', '密度'), 'STATED · ROWCALC.dk:1141', { loop: LOOPJ }),
        V('rho', L('Density ρ', '密度 ρ')),
        P('n3', L('Vertical viscosity', '垂直黏性'), 'VERTCOFC · CLINIC.dk:1405', { loop: LOOPJ, p: ['L_ORICHARD', 'FNU0_SI', 'FNUB_SI'] }),
        V('nu', L('Viscosity ν(z)', '黏性 ν(z)')),
        P('n4', L('Baroclinic momentum', '斜压动量'), 'CLINIC · ROWCALC.dk:1265',
          { loop: LOOPJ, p: ['DTUV', 'AM0_SI', 'AM1_SI', 'ACOR'], d: L('Advection, Coriolis, pressure gradient, lateral viscosity AM = AM0 + AM1 cos φ, vertical viscosity; wind stress at the top.', '平流、科氏力、气压梯度、水平黏性 AM = AM0 + AM1 cos φ、垂直黏性；顶部风应力。') }),
        V('ubc', L('New baroclinic u, v', '新的斜压 u、v')),
        P('n5', L('Vertical diffusivity', '垂直扩散系数'), 'VERTCOFT · TRACER.dk:682–700',
          { loop: LOOPJ, p: ['L_ORICHARD', 'STABLM_SI', 'KAPPA0_SI', 'DKAPPA_DZ_SI', 'L_OQLARGE', 'MAX_QLARGE_DEPTH'] }),
        V('kap', L('Diffusivity κ(z)', '扩散系数 κ(z)')),
        P('n6', L('Isopycnal slopes and GM', '等密度面斜率与 GM'), 'ISOPYC_M · IPDGMVEL · TRACER.dk:868–889',
          { loop: LOOPJ, p: ['L_OISOPYC', 'L_OISOMOM', 'AHI1_SI', 'AHI2_SI', 'AHI3_SI', 'L_OISOGM', 'L_OVISBECK'], d: L('AHI(z) = AHI2 + (AHI1 − AHI2)·e^(−z/AHI3); Gent–McWilliams eddy velocity with the Visbeck coefficient.', 'AHI(z) = AHI2 + (AHI1 − AHI2)·e^(−z/AHI3)；带 Visbeck 系数的 Gent–McWilliams 涡致速度。') }),
        V('ahi', L('AHI(z), GM eddy velocity', 'AHI(z)、GM 涡致速度')),
        P('n7', L('Advection and implicit diffusion', '平流与隐式扩散'), 'ADV_SOURCE · ISOFLUX · TRACER.dk:1094–1453', { loop: LOOPJ, p: ['DTTS', 'L_OIMPDIF'] }),
        P('n8', L('Surface fluxes', '地表通量'), 'SFCADD · TRACER.dk:1885',
          { loop: LOOPJ, p: ['L_FLUXCORR', 'L_SALFLUXFIX', 'L_REFSAL', 'SALREF'], d: L('Heat into the top layer; fresh water as a virtual salt flux; the water fix added (its heat part zeroed).', '热量进入顶层；淡水以虚盐通量进入；加上 water fix（其热量部分置零）。') }),
        P('n9', L('Ice–ocean heat', '冰–海热交换'), 'ICEFLUX · TRACER.dk:1983', { loop: LOOPJ }),
        P('n10', L('Penetrating solar', '穿透性太阳辐射'), 'SOLADD · TRACER.dk:2067–2137', { loop: LOOPJ, p: ['RSOL', 'ETA1_SI', 'ETA2_SI'] }),
        P('n11', L('Freezing', '结冰'), 'FREEZEUP · TRACER.dk:2192', { loop: LOOPJ }),
        P('n12', L('Mediterranean outflow', '地中海出流'), 'TRACER.dk:2292–2378', { loop: LOOPJ, p: ['L_OMEDOUT'] }),
        P('n13', L('Mixed layer', '混合层'), 'MIXLAY · TRACER.dk:2583', { loop: LOOPJ, p: ['LAMDA', 'DELTA_SI', 'EPSILON'] }),
        V('mld', L('Mixed-layer depth', '混合层深度')),
        P('n14', L('Convection', '对流'), 'CONVADJ · CONVFULL · TRACER.dk:2695–2755',
          { loop: LOOPJ, p: ['L_OCONVROUS', 'ISROUS…JEROUS'], d: L('Roussenov convection in a fixed box, then Rahmstorf’s complete convective adjustment everywhere.', '先在固定区域内做 Roussenov 对流，再在全球做 Rahmstorf 完整对流调整。') }),
        P('n15', L('Polar filter', '极区滤波'), 'OFILTR_CNTL · TRACER.dk:2879', { loop: LOOPJ, p: ['L_OFILTER'] }),
        V('tsn', L('New T, S', '新的 T、S')),
        P('n16', L('Barotropic flow', '正压流'), 'TROP_CTL → RELAX · TROP_CTL.dk:183',
          { p: ['L_OFREESFC', 'DTSF', 'MXSCAN', 'SOR', 'CRIT', 'ACOR', 'NISLE'], d: L('Streamfunction by successive over-relaxation with island circulations; add the depth-mean flow.', '用超松弛迭代求流函数（含绕岛环流），加上深度平均流。') }),
        V('psi', L('Streamfunction ψ, depth-mean flow', '流函数 ψ、深度平均流')),
        P('n17', L('Sea ice', '海冰'), 'ICE_CTL · OCN_CTL.dk:474', { fam: 'ice' }),
        O('onew', 'ice', L('New ice formed by freezing', '结冰生成的新冰')),
        O('ocpl', 'cpl', L('SST, surface currents', 'SST、表层流')),
        O('oice', 'ice', L('Surface currents, top-layer temperature', '表层流、顶层水温')),
        O('ost', 'state', L('T, S, u, v, ψ for the next step', '下一步的 T、S、u、v、ψ')),
        O('omld', 'stash', L('Mixed-layer depth', '混合层深度'))
      ],
      seq: 'n1>n2>n3>n4>n5>n6>n7>n8>n9>n10>n11>n12>n13>n14>n15>n16>n17',
      e: 'n1>mix mix>n4,n7 ts>n2,n7 n2>rho rho>n3,n4,n5,n6 uv>n3,n4,n16 n3>nu nu>n4 tau>n4 n4>ubc ubc>n7,n16 n5>kap kap>n7 n6>ahi ahi>n7 hf,pe,wfix>n8 icef>n9 blue>n10 n11>onew wme>n13 n13>mld mld>omld n15>tsn tsn>ost,ocpl,oice n16>psi psi>ost,ocpl'
    },

    /* ------------------------------------------------------------ sea ice */
    ice: {
      nodes: [
        I('ts', 'bl', L('Ice surface temperature (atmosphere)', '冰面温度（大气）')),
        I('st', 'state', L('Ice fraction, ice depth, snow depth', '海冰比例、冰厚、雪深')),
        I('cflx', 'cpl', L('Top melt, conductive heat flux, sublimation, snowfall', '顶部融化、传导热通量、升华、降雪')),
        I('cur', 'ocn', L('Surface currents', '表层流')),
        I('t1', 'ocn', L('Top-layer ocean temperature', '海洋顶层水温')),
        I('new', 'ocn', L('New ice from freezing', '结冰生成的新冰')),
        P('i1', L('Ice albedo', '海冰反照率'), 'FTSA · RAD_CTL1.dk:990–1026',
          { fam: 'atm', cond: L('atmosphere, radiation steps', '大气，辐射步'), p: ['ALPHAC', 'ALPHAM', 'DTICE'] }),
        P('i2', L('Ice surface energy balance', '冰面能量平衡'), 'SICE_HTF · SF_MELT · BDYLYR7A.dk:1010, 1075',
          { fam: 'atm', cond: L('atmosphere, every step', '大气，每步') }),
        P('i3', L('Split the incoming fluxes', '分配进入的通量'), 'Init_Ocean_Ice · OCN_CTL.dk:280–300', { p: ['L_SEAICE'] }),
        V('lead', L('Fluxes over ice and over leads', '冰面和冰间水道上的通量')),
        P('i4', L('Drift', '漂移'), 'ICEDRIFT · ICE_CTL.dk:429',
          { p: ['L_ICESIMPLE', 'AH_ICE'], d: L('Advect ice depth, snow depth and concentration with the surface currents (GFDL-type scheme); diffuse ice depth.', '用表层流平流冰厚、雪深和密集度（GFDL 型方案）；对冰厚做扩散。') }),
        V('dyn', L('Changes from drift and diffusion', '漂移和扩散带来的变化')),
        P('i5', L('Thermodynamics', '热力学'), 'ICEFLOE · ICE_CTL.dk:453',
          { p: ['EDDYDIFFN', 'EDDYDIFFS', 'H0', 'HICEMIN', 'AICEMIN', 'SALICE'], d: L('Semtner zero-layer model with leads: grow or melt from the atmospheric fluxes and the ocean heat flux.', '带冰间水道的 Semtner 零层模式：由大气通量和海洋热通量让冰增长或融化。') }),
        V('oh', L('Ocean-to-ice heat flux ∝ EDDYDIFF × (T₁ − T_freeze)', '海洋向冰热通量 ∝ EDDYDIFF × (T₁ − T_冰点)')),
        V('th', L('Changes from growth and melt', '增长和融化带来的变化')),
        P('i6', L('Concentration cap', '密集度上限'), 'AMX · OSETCON.dk:1163–1171', { p: ['AMXNORTH', 'AMXSOUTH'] }),
        O('oalb', 'rad', L('Sea-ice albedo', '海冰反照率')),
        O('ocpl', 'cpl', L('Daily means of top melt, conductive flux, sublimation', '顶部融化、传导通量、升华的日平均')),
        O('oatm', 'cpl', L('Ice fraction, ice depth, snow depth for day n + 1', '第 n + 1 天的海冰比例、冰厚、雪深')),
        O('oocn', 'ocn', L('Heat, salt, fresh water into the top layer', '进入顶层的热量、盐分、淡水'))
      ],
      seq: 'i1>i2>i3>i4>i5>i6',
      e: 'ts>i1 st>i1,i2,i4 i1>oalb i2>ocpl cflx>i3 i3>lead lead>i5 cur>i4 i4>dyn dyn>i5 t1,new>i5 i5>oh,th oh>oocn i5>oocn th>i6 i6>oatm'
    }
  };

  /* ================================================================ UI text */
  const UI = {
    en: {
      kinds: { proc: 'Process', var: 'Variable', in: 'Enters', out: 'Leaves', par: 'Parameters' },
      comp: { state: 'model state', file: 'file or start-up setting', stash: 'diagnostics (STASH)' },
      from: 'from', to: 'to',
      legend: [['proc', 'process (number = call order)'], ['var', 'variable inside the component'], ['in', 'enters from another component'], ['out', 'leaves to another component'], ['par', 'parameters of a process'], ['seq', 'call order'], ['data', 'data'], ['pline', 'parameter use']],
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit width',
      reads: 'Reads', writes: 'Writes', params: 'Parameters', usedBy: 'Used by', writtenBy: 'Written by', readBy: 'Read by',
      next: 'Next', prev: 'Previous', open: 'Open', value: 'Value',
      hint: 'Point at a box to light up its connections; click to pin it and see the details. Parameters are linked to the table below.',
      empty: 'Click any box in the network to see what it reads, what it writes and which parameters it uses.',
      nolib: 'The network layout needs the dagre library from cdnjs.cloudflare.com, which did not load. Check the connection and reload.',
      thead: ['Parameter', 'tdaah value', 'Used in', 'Meaning'],
      clear: 'Clear'
    },
    zh: {
      kinds: { proc: '过程', var: '变量', in: '进入', out: '离开', par: '参数' },
      comp: { state: '模式状态', file: '文件或启动设置', stash: '诊断输出（STASH）' },
      from: '来自', to: '去往',
      legend: [['proc', '过程（编号 = 调用顺序）'], ['var', '分量内部变量'], ['in', '来自其他分量'], ['out', '去往其他分量'], ['par', '某个过程的参数'], ['seq', '调用顺序'], ['data', '数据'], ['pline', '参数作用']],
      zoomIn: '放大', zoomOut: '缩小', fit: '适应宽度',
      reads: '读入', writes: '写出', params: '参数', usedBy: '用于', writtenBy: '由谁写出', readBy: '被谁读入',
      next: '下一步', prev: '上一步', open: '打开', value: '取值',
      hint: '鼠标移到方框上会点亮它的连接；点击可固定并查看详情。参数与下方表格联动。',
      empty: '点击网络中的任一方框，查看它读入什么、写出什么、用到哪些参数。',
      nolib: '网络布局需要从 cdnjs.cloudflare.com 加载 dagre 库，但加载失败。请检查网络后刷新。',
      thead: ['参数', 'tdaah 取值', '用在哪一步', '含义'],
      clear: '清除'
    }
  };

  /* ================================================================ helpers */
  let MODS = [], LANG = 'en', OPEN = () => {};
  const S = {};                       // per-module render state
  const tx = o => (o && typeof o === 'object') ? (o[LANG] || o.en) : (o == null ? '' : String(o));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const modOf = k => MODS.find(m => m.key === k);
  const compName = k => modOf(k) ? modOf(k).name : (UI[LANG].comp[k] || k);
  const famOf = (k, own) => k === 'state' ? own : (modOf(k) ? modOf(k).fam : 'neutral');

  function graph(key) {
    const m = modOf(key), net = NETS[key];
    const nodes = new Map(), edges = [];
    const params = new Map(m.params.map(r => [r[0], r]));
    net.nodes.forEach(n => nodes.set(n.id, Object.assign({}, n)));
    const add = (a, b, kind) => {
      if (!nodes.has(a) || !nodes.has(b)) throw new Error(`HadNet ${key}: unknown node in edge ${a}>${b}`);
      if (!edges.some(e => e.a === a && e.b === b)) edges.push({ a, b, kind });
    };
    net.seq.split(';').forEach(ch => { const ids = ch.split('>').map(s => s.trim()); for (let i = 0; i < ids.length - 1; i++) add(ids[i], ids[i + 1], 'seq'); });
    net.e.trim().split(/\s+/).forEach(tok => { const [l, r] = tok.split('>'); l.split(',').forEach(a => r.split(',').forEach(b => add(a, b, 'data'))); });
    let num = 0;
    net.nodes.forEach(n => { if (n.k === 'proc') nodes.get(n.id).num = ++num; });
    /* one dashed parameter box per process, listing every parameter that process uses */
    net.nodes.filter(n => n.k === 'proc' && n.p && n.p.length).forEach(n => {
      const rows = n.p.map(name => {
        if (!params.has(name)) throw new Error(`HadNet ${key}: parameter ${name} not in the page table`);
        return params.get(name);
      });
      const id = 'G:' + n.id;
      nodes.set(id, { id, k: 'par', of: n.id, rows });
      add(id, n.id, 'par');
    });
    return { m, nodes, edges };
  }

  /* text measuring and wrapping */
  const ctx = document.createElement('canvas').getContext('2d');
  function fonts() {
    const body = getComputedStyle(document.body).fontFamily;
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace';
    return { t: `600 13px ${body}`, b: `12.5px ${body}`, s: `11px ${body}`, m: `11px ${mono}`, mb: `500 11px ${mono}` };
  }
  function wrap(text, font, max) {
    ctx.font = font;
    const toks = String(text).match(/[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+|\s+/g) || [''];
    const lines = []; let cur = '';
    toks.forEach(t => {
      const tryLine = cur + t;
      if (cur.trim() && ctx.measureText(tryLine.trimEnd()).width > max) { lines.push(cur.trimEnd()); cur = t.trimStart(); }
      else cur = tryLine;
    });
    if (cur.trim() || !lines.length) lines.push(cur.trim());
    return lines.map(s => ({ s, w: ctx.measureText(s).width }));
  }

  /* node boxes: lines of {s, w, cls, h} */
  function box(n, F, own) {
    const L = [];
    const push = (arr, cls, h) => arr.forEach(x => L.push({ s: x.s, w: x.w, cls, h }));
    let padL = 10, padR = 10, min = 60;
    if (n.k === 'proc') {
      padL = 34; padR = 12; min = 120;
      push(wrap(tx(n.t), F.t, 190), 't1', 17);
      push(wrap(n.r, F.m, 205), 'mono', 14);
      const tag = [n.loop ? tx(n.loop) : '', n.cond ? tx(n.cond) : ''].filter(Boolean).join(' · ');
      if (tag) push(wrap(tag, F.s, 205), 'tag', 14);
    } else if (n.k === 'par') {
      padL = 8; padR = 8; min = 40;
      n.rows.forEach(r => {
        const v = r[3] || r[1];
        ctx.font = F.mb; const w1 = ctx.measureText(r[0]).width;
        ctx.font = F.m; const w2 = ctx.measureText(' = ' + v).width;
        L.push({ s: r[0], w: Math.min(w1 + w2, 250), cls: 'pname', h: 16, val: v, p: r });
      });
    } else {
      push(wrap(tx(n.t), F.b, 160), 'lab', 16);
      if (n.k === 'in' || n.k === 'out') push(wrap(`${n.k === 'in' ? '↘ ' + UI[LANG].from : '↗ ' + UI[LANG].to} ${compName(n.c)}`, F.s, 160), 'cap', 14);
    }
    const w = Math.max(min, Math.ceil(Math.max(...L.map(l => l.w)) + padL + padR));
    const h = Math.ceil(L.reduce((a, l) => a + l.h, 0) + (n.k === 'par' ? 8 : 14));
    return { w, h, L, padL, fam: n.k === 'proc' ? (n.fam || own) : (n.k === 'in' || n.k === 'out') ? famOf(n.c, own) : 'neutral' };
  }

  /* smooth path through dagre points */
  function pathD(p) {
    if (p.length < 3) return `M${p[0].x},${p[0].y}L${p[p.length - 1].x},${p[p.length - 1].y}`;
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += `C${(b.x + (c.x - a.x) / 6).toFixed(1)},${(b.y + (c.y - a.y) / 6).toFixed(1)} ${(c.x - (e.x - b.x) / 6).toFixed(1)},${(c.y - (e.y - b.y) / 6).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  }

  /* ================================================================ panel HTML */
  function panel(m) {
    if (!NETS[m.key]) return '';
    const U = UI[LANG];
    const leg = U.legend.map(([k, t]) => `<span class="nl-${k}"><i></i>${t}</span>`).join('');
    let G; try { G = graph(m.key); } catch (err) { return `<p class="net-nolib">${esc(err.message)}</p>`; }
    S[m.key] = { G, drawn: false, scale: 1, fit: true, pin: null };
    const used = {};
    G.nodes.forEach(n => { if (n.k === 'par') { const pr = G.nodes.get(n.of); n.rows.forEach(r => (used[r[0]] = used[r[0]] || []).push(pr)); } });
    const rows = m.params.map(r => `<tr data-p="${esc(r[0])}" tabindex="0"><td class="k">${r[0]}</td><td class="v">${r[1]}</td><td class="u">${(used[r[0]] || []).map(n => `<span class="ul"><span class="ub">${n.num}</span>${esc(tx(n.t))}</span>`).join('')}</td><td>${r[2]}</td></tr>`).join('');
    return `<div class="netbox" data-key="${m.key}">
      <div class="net-top"><div class="net-legend">${leg}</div>
        <div class="net-tools"><button type="button" class="btn sm" data-z="out" aria-label="${U.zoomOut}">−</button><button type="button" class="btn sm" data-z="fit">${U.fit}</button><button type="button" class="btn sm" data-z="in" aria-label="${U.zoomIn}">+</button></div></div>
      <p class="mf-hint">${U.hint}</p>
      <div class="net-stage"><div class="net-scroll"><div class="net" id="net-${m.key}"></div></div>
        <aside class="net-card" aria-live="polite"><p class="nc-empty">${U.empty}</p></aside></div>
    </div>
    <div class="tablewrap"><table class="ptab"><thead><tr>${U.thead.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ================================================================ drawing */
  function draw(key) {
    const st = S[key]; if (!st || st.drawn) return;
    const host = document.getElementById('net-' + key); if (!host) return;
    if (!window.dagre) { host.innerHTML = `<p class="net-nolib">${UI[LANG].nolib}</p>`; return; }
    const { G, m } = { G: st.G, m: st.G.m };
    const F = fonts();
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 14, ranksep: 30, edgesep: 8, marginx: 14, marginy: 14 });
    g.setDefaultEdgeLabel(() => ({}));
    const B = new Map();
    G.nodes.forEach(n => { const b = box(n, F, m.fam); B.set(n.id, b); g.setNode(n.id, { width: b.w, height: b.h }); });
    G.edges.forEach(e => g.setEdge(e.a, e.b, { weight: e.kind === 'seq' ? 8 : e.kind === 'par' ? 2 : 1, minlen: 1 }));
    dagre.layout(g);
    const W = Math.ceil(g.graph().width), H = Math.ceil(g.graph().height);
    const id = s => `${key}-${s}`;
    let h = `<svg class="netsvg" viewBox="0 0 ${W} ${H}" data-w="${W}" data-h="${H}" role="group" aria-label="${esc(m.name)}">`;
    h += `<defs>${['a', 's', 'h'].map(k => `<marker id="${id(k)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk-${k}"/></marker>`).join('')}</defs>`;
    h += '<g class="edges">';
    G.edges.forEach((e, i) => {
      const pts = g.edge(e.a, e.b).points;
      h += `<g class="ne ${e.kind}" data-a="${esc(e.a)}" data-b="${esc(e.b)}"><path d="${pathD(pts)}" marker-end="url(#${id(e.kind === 'seq' ? 's' : 'a')})"/></g>`;
    });
    h += '</g><g class="nodes">';
    G.nodes.forEach(n => {
      const b = B.get(n.id), p = g.node(n.id), x = p.x - b.w / 2, y = p.y - b.h / 2;
      const cls = ['nn', n.k, 'fam-' + b.fam, n.cond ? 'cond' : '', n.off ? 'off' : ''].join(' ');
      const label = n.k === 'par' ? n.rows.map(r => `${r[0]} = ${r[1]}`).join('; ') : n.k === 'proc' ? `${n.num}. ${tx(n.t)}` : tx(n.t);
      h += `<g class="${cls}" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(label)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">`;
      h += `<rect width="${b.w}" height="${b.h}" rx="${n.k === 'proc' ? 8 : n.k === 'par' ? 4 : 11}"/>`;
      if (n.k === 'proc') h += `<circle class="nb" cx="17" cy="${b.h / 2}" r="10"/><text class="nbt" x="17" y="${b.h / 2 + 4}" text-anchor="middle">${n.num}</text>`;
      let yy = n.k === 'par' ? 4 : 7;
      b.L.forEach(l => {
        if (l.p) {
          h += `<g class="pl" data-p="${esc(l.p[0])}"><title>${esc(l.p[0] + ' = ' + l.p[1] + ' — ' + l.p[2])}</title><rect class="plbg" x="3" y="${yy}" width="${b.w - 6}" height="${l.h}" rx="3"/>`;
          h += `<text x="${b.padL}" y="${yy + l.h - 4}"><tspan class="pname">${esc(l.s)}</tspan><tspan class="pval"> = ${esc(l.val)}</tspan></text></g>`;
          yy += l.h; return;
        }
        yy += l.h;
        h += `<text class="${l.cls}" x="${b.padL}" y="${yy - 3}">${esc(l.s)}</text>`;
      });
      h += '</g>';
    });
    h += '</g></svg>';
    host.innerHTML = h;
    st.drawn = true; st.W = W; st.H = H;
    fit(key);
    wire(key);
  }

  function setScale(key, s) {
    const st = S[key], svg = document.querySelector(`#net-${key} svg`); if (!svg) return;
    st.scale = Math.max(0.2, Math.min(2, s));
    svg.setAttribute('width', Math.round(st.W * st.scale));
    svg.setAttribute('height', Math.round(st.H * st.scale));
  }
  /* readable: open at ≥ 80 % and pan; overview: shrink the whole network into the box */
  function fit(key, overview) {
    const st = S[key], sc = document.querySelector(`#net-${key}`); if (!sc || !st.W) return;
    const avail = sc.parentElement.clientWidth - 12;
    st.fit = !overview;
    const s = avail > 0 ? Math.min(1, avail / st.W) : 1;
    setScale(key, overview ? s : Math.max(0.8, s));
  }

  /* highlighting and the detail card */
  function neighbours(G, nid) {
    const ns = new Set([nid]), es = [];
    G.edges.forEach((e, i) => { if (e.a === nid || e.b === nid) { ns.add(e.a); ns.add(e.b); es.push(i); } });
    return { ns, es };
  }
  function light(key, nid) {
    const host = document.getElementById('net-' + key), svg = host && host.querySelector('svg'); if (!svg) return;
    const G = S[key].G;
    svg.classList.toggle('focus', !!nid);
    const { ns } = nid ? neighbours(G, nid) : { ns: new Set() };
    svg.querySelectorAll('.nn').forEach(el => { el.classList.toggle('lit', ns.has(el.dataset.id)); el.classList.toggle('me', el.dataset.id === nid); });
    svg.querySelectorAll('.ne').forEach(el => {
      const on = !!nid && (el.dataset.a === nid || el.dataset.b === nid);
      el.classList.toggle('lit', on);
      const p = el.querySelector('path');
      p.setAttribute('marker-end', `url(#${key}-${on ? 'h' : el.classList.contains('seq') ? 's' : 'a'})`);
    });
  }
  function card(key, nid) {
    const st = S[key], G = st.G, U = UI[LANG];
    const el = document.querySelector(`.netbox[data-key="${key}"] .net-card`); if (!el) return;
    if (!nid) { el.innerHTML = `<p class="nc-empty">${U.empty}</p>`; return; }
    const n = G.nodes.get(nid);
    const name = x => x.k === 'par' ? `${U.kinds.par} · ${G.nodes.get(x.of).num}. ${tx(G.nodes.get(x.of).t)}` : x.k === 'proc' ? `${x.num}. ${tx(x.t)}` : tx(x.t);
    const link = x => `<button type="button" class="nc-link k-${x.k}" data-go="${esc(x.id)}">${esc(name(x))}</button>`;
    const ins = G.edges.filter(e => e.b === nid).map(e => G.nodes.get(e.a));
    const outs = G.edges.filter(e => e.a === nid).map(e => G.nodes.get(e.b));
    const list = (title, arr) => arr.length ? `<div class="nc-sec"><h5>${title}</h5>${arr.map(link).join('')}</div>` : '';
    let h = `<div class="nc-kind k-${n.k}">${U.kinds[n.k]}</div><h4>${esc(name(n))}</h4>`;
    if (n.k === 'proc') {
      h += `<div class="nc-r">${esc(n.r)}</div>`;
      const tag = [n.loop ? tx(n.loop) : '', n.cond ? tx(n.cond) : ''].filter(Boolean).join(' · ');
      if (tag) h += `<div class="nc-tag">${esc(tag)}</div>`;
      if (n.d) h += `<p>${esc(tx(n.d))}</p>`;
      const prevs = ins.filter(x => x.k === 'proc'), nexts = outs.filter(x => x.k === 'proc');
      h += list(U.reads, ins.filter(x => x.k === 'in' || x.k === 'var'));
      h += list(U.params, ins.filter(x => x.k === 'par'));
      h += list(U.writes, outs.filter(x => x.k !== 'proc'));
      h += list(U.prev, prevs) + list(U.next, nexts);
    } else if (n.k === 'par') {
      h += `<div class="nc-sec">${n.rows.map(r => `<button type="button" class="nc-link k-par" data-p="${esc(r[0])}">${esc(r[0])} = ${r[1]}</button><p class="nc-mean">${r[2]}</p>`).join('')}</div>` + list(U.usedBy, outs);
    } else {
      if (n.k === 'in' || n.k === 'out') {
        const c = n.c, can = !!modOf(c) && c !== st.G.m.key;
        h += `<div class="nc-comp">${n.k === 'in' ? U.from : U.to} <b>${esc(compName(c))}</b>${can ? ` <button type="button" class="nc-open" data-open="${c}">${U.open} ↗</button>` : ''}</div>`;
      }
      h += list(U.writtenBy, ins) + list(U.readBy, outs);
    }
    h += `<button type="button" class="nc-clear">${U.clear}</button>`;
    el.innerHTML = h;
  }
  function pin(key, nid) { S[key].pin = nid; light(key, nid); card(key, nid); }

  function wire(key) {
    const box = document.querySelector(`.netbox[data-key="${key}"]`), host = document.getElementById('net-' + key);
    if (!box || box.dataset.wired) return; box.dataset.wired = '1';
    const nodeOf = e => e.target.closest && e.target.closest('.nn');
    /* drag the background with the mouse to pan */
    const sc = host.parentElement; let drag = null, moved = false;
    sc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || nodeOf(e)) return;
      drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; moved = false;
      sc.setPointerCapture(e.pointerId); sc.classList.add('dragging');
    });
    sc.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      sc.scrollLeft = drag.l - dx; sc.scrollTop = drag.t - dy;
    });
    const end = () => { drag = null; sc.classList.remove('dragging'); };
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    host.addEventListener('mouseover', e => { const n = nodeOf(e); if (n) light(key, n.dataset.id); });
    host.addEventListener('mouseout', e => { const n = nodeOf(e); if (n) light(key, S[key].pin); });
    host.addEventListener('click', e => {
      if (moved) { moved = false; return; }
      const n = nodeOf(e); pin(key, n ? n.dataset.id : null);
    });
    host.addEventListener('keydown', e => {
      const n = nodeOf(e); if (!n) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pin(key, n.dataset.id); }
      else if (e.key === 'Escape') pin(key, null);
    });
    host.addEventListener('focusin', e => { const n = nodeOf(e); if (n) light(key, n.dataset.id); });
    box.addEventListener('click', e => {
      const z = e.target.closest('[data-z]');
      if (z) { const st = S[key]; if (z.dataset.z === 'fit') fit(key, true); else { st.fit = false; setScale(key, st.scale * (z.dataset.z === 'in' ? 1.2 : 1 / 1.2)); } return; }
      const go = e.target.closest('[data-go]');
      if (go) { pin(key, go.dataset.go); const el = host.querySelector(`.nn[data-id="${CSS.escape(go.dataset.go)}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
      const op = e.target.closest('[data-open]'); if (op) { OPEN(op.dataset.open); return; }
      if (e.target.closest('.nc-clear')) pin(key, null);
    });
  }

  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => Object.keys(S).forEach(k => { if (S[k].drawn && S[k].fit) fit(k); }), 150); });

  function show(key) {
    if (!S[key]) return;
    const go = () => { draw(key); if (S[key].drawn && S[key].fit) fit(key); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }
  function init(mods, lang, open) { MODS = mods; LANG = lang; if (open) OPEN = open; }

  window.HadNet = { init, panel, show, NETS, graph, _box: box, _wrap: wrap };
})();
