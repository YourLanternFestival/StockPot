// ===== 新手引导教程 =====
const TOUR_STEPS = [
  {
    target: null,
    title: '欢迎使用洋安出入库管理系统',
    content: '本系统帮助您管理食堂物资的入库、出库、库存和采购。接下来将用1分钟带您了解核心功能。如果已经熟悉，可以随时点击"跳过引导"。',
    placement: 'center',
  },
  {
    target: '.sidebar',
    title: '功能导航',
    content: '所有功能页面通过左侧菜单切换。从上到下依次是：总览、库存查询、入库、出库、月度台账、产品管理、采购单、询价和设置。',
    placement: 'right',
  },
  {
    target: '.stats-grid',
    title: '总览仪表盘',
    content: '系统启动后默认显示总览页。这里展示在库品种数、累计入出库笔数和临期预警数量。向下滚动还可以看到近30天趋势图和库存分布饼图。',
    placement: 'bottom',
  },
  {
    target: '[data-page="products"]',
    title: '先录入产品',
    content: '使用系统前，需要先在"产品管理"中录入材料清单（名称、规格、单位、保质期）。也可以通过"导入数据"功能从 xlsx 批量导入。点击此处可跳转到产品管理页。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('products'),
  },
  {
    target: '[data-page="inbound"]',
    title: '入库登记',
    content: '在"入库登记"页面批量录入入库记录。输入材料名称时会自动补全已有产品，按回车键可快速跳到下一行。支持 Excel 粘贴批量录入。点击此处可跳转体验。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('inbound'),
  },
  {
    target: '[data-page="outbound"]',
    title: '出库登记',
    content: '"出库登记"与入库类似，但多了领取人字段和库存校验。出库数量不能超过当前库存，系统会自动提示。点击此处可跳转体验。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('outbound'),
  },
  {
    target: '[data-page="inventory"]',
    title: '库存查询与预警',
    content: '在"库存查询"中搜索任意材料查看详细库存和出入库流水。"过期预警"标签页会列出临期和已过期的物资，方便及时处理。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('inventory'),
  },
  {
    target: '[data-page="purchase"]',
    title: '采购单管理',
    content: '采购单是最复杂的模块，支持三种食堂模式（默认/多食堂/小所）。可在"设置"页面切换食堂模式。小所模式下还支持分组输入和矩阵输入两种样式。',
    placement: 'right',
  },
  {
    target: null,
    title: '快速上手提示',
    content: '• 按 Ctrl+Enter 可在两种回车导航模式间快速切换\n• 出入库录入表格支持 Excel 格式的列粘贴\n• 设置页面可配置每页显示行数、历史记录天数等\n• 随时可在设置页面重新查看本引导',
    placement: 'center',
  },
];

let currentStep = 0;

function startTour(stepIndex = 0) {
  currentStep = stepIndex;
  const overlay = document.getElementById('tour-overlay');
  if (!overlay) {
    createTourOverlay();
  }
  document.getElementById('tour-overlay').style.display = 'block';
  showStep(currentStep);
}

function createTourOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'tour-overlay';
  overlay.innerHTML = `
    <div class="tour-backdrop" id="tour-backdrop"></div>
    <div class="tour-popover" id="tour-popover">
      <div class="tour-step-indicator" id="tour-step-indicator"></div>
      <div class="tour-title" id="tour-title"></div>
      <div class="tour-content" id="tour-content"></div>
      <div class="tour-actions">
        <button class="tour-skip" onclick="endTour()">跳过引导</button>
        <div class="tour-nav">
          <button class="tour-prev" id="tour-prev" onclick="prevStep()">上一步</button>
          <button class="tour-next" id="tour-next" onclick="nextStep()">下一步</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function showStep(index) {
  const step = TOUR_STEPS[index];
  if (!step) return;

  const backdrop = document.getElementById('tour-backdrop');
  const popover = document.getElementById('tour-popover');
  const title = document.getElementById('tour-title');
  const content = document.getElementById('tour-content');
  const stepIndicator = document.getElementById('tour-step-indicator');
  const prevBtn = document.getElementById('tour-prev');
  const nextBtn = document.getElementById('tour-next');

  // Update content
  stepIndicator.textContent = `${index + 1}/${TOUR_STEPS.length}`;
  title.textContent = step.title;
  content.textContent = step.content;

  // Update buttons
  prevBtn.style.display = index === 0 ? 'none' : 'inline-flex';
  nextBtn.textContent = index === TOUR_STEPS.length - 1 ? '完成引导' : '下一步';

  // Position highlight
  if (step.target) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      backdrop.style.display = 'block';
      backdrop.style.top = rect.top + 'px';
      backdrop.style.left = rect.left + 'px';
      backdrop.style.width = rect.width + 'px';
      backdrop.style.height = rect.height + 'px';

      // Position popover
      positionPopover(popover, rect, step.placement);

      // Make clickable if needed
      if (step.clickable) {
        backdrop.style.pointerEvents = 'auto';
        backdrop.onclick = () => {
          if (step.action) step.action();
          nextStep();
        };
        backdrop.style.cursor = 'pointer';
      } else {
        backdrop.style.pointerEvents = 'none';
        backdrop.onclick = null;
        backdrop.style.cursor = 'default';
      }
    }
  } else {
    // Center mode
    backdrop.style.display = 'none';
    popover.style.position = 'fixed';
    popover.style.top = '50%';
    popover.style.left = '50%';
    popover.style.transform = 'translate(-50%, -50%)';
  }
}

function positionPopover(popover, targetRect, placement) {
  popover.style.position = 'fixed';
  popover.style.transform = 'none';
  const gap = 16;

  switch (placement) {
    case 'right':
      popover.style.top = targetRect.top + 'px';
      popover.style.left = (targetRect.right + gap) + 'px';
      break;
    case 'left':
      popover.style.top = targetRect.top + 'px';
      popover.style.right = (window.innerWidth - targetRect.left + gap) + 'px';
      popover.style.left = 'auto';
      break;
    case 'bottom':
      popover.style.top = (targetRect.bottom + gap) + 'px';
      popover.style.left = targetRect.left + 'px';
      break;
    case 'top':
      popover.style.bottom = (window.innerHeight - targetRect.top + gap) + 'px';
      popover.style.top = 'auto';
      popover.style.left = targetRect.left + 'px';
      break;
    default:
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
  }
}

function nextStep() {
  if (currentStep < TOUR_STEPS.length - 1) {
    currentStep++;
    showStep(currentStep);
  } else {
    endTour();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
}

function endTour() {
  const overlay = document.getElementById('tour-overlay');
  if (overlay) overlay.style.display = 'none';
  // Save tutorial completed state
  window.api.setSetting('tutorial_completed', '1');
}

// Check and start tour on first launch
async function checkAndStartTour() {
  try {
    const completed = await window.api.getSetting('tutorial_completed');
    if (completed !== '1') {
      setTimeout(() => startTour(0), 500);
    }
  } catch (err) {
    // Ignore error, don't start tour
  }
}
