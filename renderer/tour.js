// ===== 新手引导教程 =====
const TOUR_STEPS = [
  {
    target: null,
    title: '欢迎使用食堂物资管理',
    content: '本系统帮您做两件事：\n① 管理仓库出入库（进货、领料、查库存）\n② 编制采购单（自动补全价格，导出给供应商）\n\n接下来用 5 步带您走完核心流程。随时可以点击"跳过引导"。',
    placement: 'center',
  },
  {
    target: '[data-page="products"]',
    title: '录入产品',
    content: '使用系统前，先在"产品管理"中录入食堂使用的材料——名称、规格、单位和保质期。入库出库时才能选择这些产品。\n\n支持从 Excel 批量导入。点击此处可跳转到产品管理页。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('products'),
  },
  {
    target: '[data-page="inbound"]',
    title: '日常入库',
    content: '每天进货时，在"入库登记"页面录入。输入材料名称会自动弹出产品列表供选择，填好数量和日期后提交即可。\n\n支持多行批量录入，点击此处可跳转体验。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('inbound'),
  },
  {
    target: '[data-page="outbound"]',
    title: '日常出库',
    content: '厨房领料时，在"出库登记"页面录入。选择材料后会显示当前库存，出库数量不能超库存。\n\n填好领取人（厨房、面点房等）后提交。点击此处可跳转体验。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('outbound'),
  },
  {
    target: '[data-page="purchase"]',
    title: '编制采购单',
    content: '在"采购单"页面编制每日采购计划。输入品名自动弹出询价数据（带出规格、单价），填好数量即可。\n\n导出 Excel 发给供应商。支持默认/多食堂/小所三种模式。点击此处可跳转查看。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('purchase'),
  },
  {
    target: '[data-page="inventory"]',
    title: '查看库存与预警',
    content: '在"库存查询"中搜索产品查看实时库存和出入库流水。"过期预警"标出临期和已过期食材——红色=已过期、橙色=即将到期、黄色=需关注。\n\n日常顺序：入库→出库→采购单，月底看台账核对。点击此处完成教程。',
    placement: 'right',
    clickable: true,
    action: () => navigateTo('inventory'),
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
  content.innerHTML = step.content.replace(/\n/g, '<br>');

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
