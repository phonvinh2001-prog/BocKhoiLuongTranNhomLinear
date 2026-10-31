// Adapted from phonvinh2001-prog/GopKichThuoc (MIT), production core 1.8.
/**
 * CuttingOptimizer - Thuật toán tối ưu hóa cắt nhôm
 * Sử dụng First Fit Decreasing + Global Optimization
 */

class CuttingOptimizer {
  constructor() {
    this.results = null;
  }

  /**
   * Hàm chính: Tối ưu hóa cắt stock
   * @param {Array} items - Danh sách chi tiết [{length, quantity}]
   * @param {Object} config - Cấu hình {kerf, minLength, maxLength, stepSize, maxWaste}
   * @param {Array} existingStocks - Tồn kho có sẵn [{length, quantity}]
   * @returns {Object} Kết quả tối ưu
   */
  optimize(items, config, existingStocks = []) {
    // Validate input
    if (!items || items.length === 0) {
      throw new Error("Danh sách chi tiết không được rỗng");
    }

    // Expand items (chuyển quantity thành mảng riêng lẻ)
    const expandedItems = this.expandItems(items);

    // Sắp xếp từ dài đến ngắn (First Fit Decreasing)
    expandedItems.sort((a, b) => b - a);

    // Kiểm tra item dài hơn max
    const maxItem = expandedItems[0];
    if (maxItem > config.maxLength) {
      throw new Error(
        `Chi tiết ${maxItem}mm dài hơn kích thước tối đa ${config.maxLength}mm`,
      );
    }

    // Thử sử dụng tồn kho trước
    let remainingItems = [...expandedItems];
    const usedStocks = [];

    if (existingStocks && existingStocks.length > 0) {
      const stockResult = this.useExistingStocks(
        remainingItems,
        existingStocks,
        config.kerf,
      );
      remainingItems = stockResult.remainingItems;
      usedStocks.push(...stockResult.usedStocks);
    }

    // Nếu còn items, tìm kích thước tối ưu (Sử dụng Multi-Stock)
    let bestResult = null;

    if (remainingItems.length > 0) {
      // Sử dụng thuật toán đa kích thước để tối ưu triệt để
      bestResult = this.multiStockOptimization(remainingItems, config);
    }

    // Kết hợp kết quả
    const finalResult = this.combineResults(
      usedStocks,
      bestResult,
      expandedItems.length,
      config,
    );

    this.results = finalResult;
    return finalResult;
  }

  /**
   * Expand items từ {length, quantity} thành mảng riêng lẻ
   */
  expandItems(items) {
    const expanded = [];
    items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        expanded.push(item.length);
      }
    });
    return expanded;
  }

  /**
   * Sử dụng thanh tồn kho trước
   */
  useExistingStocks(items, existingStocks, kerf) {
    const usedStocks = [];
    const remainingItems = [...items];

    // Expand existing stocks
    const expandedStocks = this.expandItems(existingStocks);
    expandedStocks.sort((a, b) => b - a); // Dùng thanh dài trước

    expandedStocks.forEach((stockLength) => {
      const stock = {
        length: stockLength,
        cuts: [],
        remaining: stockLength,
        isExisting: true,
      };

      let i = 0;
      while (i < remainingItems.length) {
        const itemLength = remainingItems[i];
        const requiredSpace = itemLength + (stock.cuts.length > 0 ? kerf : 0);

        if (stock.remaining >= requiredSpace) {
          stock.cuts.push(itemLength);
          stock.remaining -= requiredSpace;
          remainingItems.splice(i, 1);
        } else {
          i++;
        }
      }

      if (stock.cuts.length > 0) {
        usedStocks.push(stock);
      }
    });

    return { usedStocks, remainingItems };
  }

  /**
   * Tìm kích thước phôi tối ưu bằng Global Search
   */
  /**
   * Tìm kích thước phôi tối ưu bằng Global Search
   */
  findOptimalStockLength(items, config) {
    let bestResult = null;
    let bestEfficiency = -1; // Khởi tạo -1 để đảm bảo có kết quả đầu tiên

    // Sort items để đảm bảo First Fit Decreasing hoạt động đúng
    // (Copy để không ảnh hưởng mảng gốc)
    const sortedItems = [...items].sort((a, b) => b - a);
    const maxItemLength = sortedItems[0];

    // Thử tất cả kích thước từ min đến max với bước nhảy
    for (
      let stockLength = config.minLength;
      stockLength <= config.maxLength;
      stockLength += config.stepSize
    ) {
      // 🛑 QUAN TRỌNG: Bỏ qua nếu kích thước phôi nhỏ hơn chi tiết lớn nhất
      // Ngăn chặn lỗi "Phế liệu âm" và chọn sai stock ảo
      if (stockLength < maxItemLength) continue;

      const result = this.firstFitDecreasing(
        sortedItems,
        stockLength,
        config.kerf,
      );

      // Tính hiệu suất
      const totalUsed = result.stocks.reduce(
        (sum, stock) => sum + stock.cuts.reduce((s, cut) => s + cut, 0),
        0,
      );
      const totalLength = result.stocks.length * stockLength;

      // Tính waste chuẩn xác (dựa trên remaining thực tế)
      const totalWaste = result.stocks.reduce(
        (sum, stock) => sum + stock.remaining,
        0,
      );
      const totalUsedWithKerf = totalLength - totalWaste;

      const efficiency = (totalUsedWithKerf / totalLength) * 100;

      result.efficiency = efficiency;
      result.totalUsed = totalUsed;
      result.totalLength = totalLength;
      result.totalWaste = totalWaste;
      result.stockLength = stockLength;

      // Chọn phương án tốt nhất
      // Ưu tiên: Hiệu suất cao > Số thanh ít
      if (
        efficiency > bestEfficiency ||
        (Math.abs(efficiency - bestEfficiency) < 0.01 && // So sánh float an toàn
          result.stocks.length <
            (bestResult ? bestResult.stocks.length : Infinity))
      ) {
        bestEfficiency = efficiency;
        bestResult = result;
      }
    }

    return bestResult;
  }

  /**
   * Thuật toán First Fit Decreasing
   */
  firstFitDecreasing(items, stockLength, kerf) {
    const stocks = [];

    items.forEach((itemLength) => {
      let placed = false;

      // Thử xếp vào thanh hiện có
      for (let stock of stocks) {
        const requiredSpace = itemLength + (stock.cuts.length > 0 ? kerf : 0);

        if (stock.remaining >= requiredSpace) {
          stock.cuts.push(itemLength);
          stock.remaining -= requiredSpace;
          placed = true;
          break;
        }
      }

      // Nếu không xếp được, tạo thanh mới
      if (!placed) {
        const newStock = {
          length: stockLength,
          cuts: [itemLength],
          remaining: stockLength - itemLength,
          isExisting: false,
        };
        stocks.push(newStock);
      }
    });

    return { stocks };
  }

  /**
   * Kết hợp kết quả từ tồn kho và phôi mới
   */
  combineResults(usedStocks, newStocksResult, totalItems, config) {
    const allStocks = [...usedStocks];

    if (newStocksResult) {
      allStocks.push(...newStocksResult.stocks);
    }

    // Tính toán tổng hợp
    // totalUsed = tổng chiều dài chi tiết (không tính mạch cắt)
    const totalUsed = allStocks.reduce(
      (sum, stock) => sum + stock.cuts.reduce((s, cut) => s + cut, 0),
      0,
    );

    const totalLength = allStocks.reduce((sum, stock) => sum + stock.length, 0);

    // totalWaste = tổng phế liệu thực tế (đã tính mạch cắt)
    // Phải dùng stock.remaining vì nó đã trừ cả mạch cắt
    const totalWaste = allStocks.reduce(
      (sum, stock) => sum + stock.remaining,
      0,
    );

    // totalUsedWithKerf = tổng sử dụng thực tế (bao gồm cả mạch cắt)
    const totalUsedWithKerf = totalLength - totalWaste;

    const efficiency = (totalUsedWithKerf / totalLength) * 100;

    // Tạo summary theo kích thước
    const summary = this.createSummary(allStocks);

    // Tạo warnings
    const warnings = this.generateWarnings(allStocks, config, efficiency);

    return {
      stocks: allStocks,
      summary,
      efficiency: efficiency.toFixed(2),
      totalUsed,
      totalLength,
      totalWaste,
      totalStocks: allStocks.length,
      totalItems,
      optimalLength: newStocksResult ? newStocksResult.stockLength : null,
      warnings,
    };
  }

  /**
   * Tạo bảng tổng hợp theo kích thước
   */
  createSummary(stocks) {
    const summary = {};

    stocks.forEach((stock) => {
      const key = stock.length;
      if (!summary[key]) {
        summary[key] = {
          length: key,
          quantity: 0,
          isExisting: stock.isExisting,
        };
      }
      summary[key].quantity++;
    });

    return Object.values(summary).sort((a, b) => b.length - a.length);
  }

  /**
   * Tạo cảnh báo
   */
  /**
   * Tạo cảnh báo (Gộp nhóm thông minh)
   */
  generateWarnings(stocks, config, efficiency) {
    const warnings = [];

    // 1. Cảnh báo hiệu suất thấp (Chung)
    if (efficiency < 80) {
      warnings.push({
        type: "warning",
        message: `Hiệu suất tổng thể chỉ ${efficiency.toFixed(1)}%, có thể chưa tối ưu. Thử điều chỉnh khoảng tìm kiếm hoặc bước nhảy.`,
      });
    }

    // 2. Gom nhóm các lỗi cụ thể để báo cáo gọn hơn
    const groups = {
      criticalWaste: {}, // Lãng phí nghiêm trọng
      warningWaste: {}, // Lãng phí cảnh báo (50-70%)
      overMaxWaste: {}, // Vượt ngưỡng Max Waste
      minSizeSuggestion: {}, // Gợi ý giảm Min Size
    };

    stocks.forEach((stock, index) => {
      const idx = index + 1;
      const wastePercent = (stock.remaining / stock.length) * 100;
      const wasteVal = stock.remaining.toFixed(0);

      // A. Bad Solution Detection
      if (wastePercent > 70) {
        const key = `${stock.length}_${wasteVal}_${wastePercent.toFixed(1)}`;
        if (!groups.criticalWaste[key])
          groups.criticalWaste[key] = {
            ids: [],
            len: stock.length,
            waste: wasteVal,
            pct: wastePercent.toFixed(1),
            cuts: stock.cuts,
          };
        groups.criticalWaste[key].ids.push(idx);
      } else if (wastePercent > 50) {
        const key = `${stock.length}_${wasteVal}_${wastePercent.toFixed(1)}`;
        if (!groups.warningWaste[key])
          groups.warningWaste[key] = {
            ids: [],
            len: stock.length,
            waste: wasteVal,
            pct: wastePercent.toFixed(1),
          };
        groups.warningWaste[key].ids.push(idx);
      }

      // B. Max Waste Exceeded (chỉ báo nếu chưa nằm trong critical/warning trên để tránh duplicate)
      if (stock.remaining > config.maxWaste && wastePercent <= 50) {
        const key = `${stock.length}_${wasteVal}`;
        if (!groups.overMaxWaste[key])
          groups.overMaxWaste[key] = {
            ids: [],
            len: stock.length,
            waste: wasteVal,
          };
        groups.overMaxWaste[key].ids.push(idx);
      }

      // C. Min Size Suggestion
      if (!stock.isExisting) {
        const usedLength = stock.length - stock.remaining;
        if (
          usedLength < config.minLength &&
          stock.length === config.minLength
        ) {
          const suggestedMin = Math.ceil(usedLength / 100) * 100;
          const key = `${usedLength.toFixed(0)}_${suggestedMin}`;
          if (!groups.minSizeSuggestion[key])
            groups.minSizeSuggestion[key] = {
              ids: [],
              used: usedLength.toFixed(0),
              suggest: suggestedMin,
            };
          groups.minSizeSuggestion[key].ids.push(idx);
        }
      }
    });

    // 3. Generate messages từ groups

    // Critical Waste
    Object.values(groups.criticalWaste).forEach((g) => {
      const range = this.formatIndexRanges(g.ids);
      warnings.push({
        type: "error",
        message: `🚨 CRITICAL (${g.ids.length} thanh): Các thanh ${range} (${g.len}mm) dư ${g.waste}mm (${g.pct}%). Đề xuất: Ghép với thanh khác hoặc đặt custom size.`,
      });
    });

    // Warning Waste
    Object.values(groups.warningWaste).forEach((g) => {
      const range = this.formatIndexRanges(g.ids);
      warnings.push({
        type: "warning",
        message: `⚠️ WARNING (${g.ids.length} thanh): Các thanh ${range} (${g.len}mm) có phế liệu ${g.pct}%.`,
      });
    });

    // Over Max Waste
    Object.values(groups.overMaxWaste).forEach((g) => {
      const range = this.formatIndexRanges(g.ids);
      warnings.push({
        type: "warning",
        message: `⚠️ Phế liệu cao (${g.ids.length} thanh): Các thanh ${range} (${g.len}mm) có phế liệu ${g.waste}mm vượt ngưỡng ${config.maxWaste}mm.`,
      });
    });

    // Min Size Suggestions
    Object.values(groups.minSizeSuggestion).forEach((g) => {
      const range = this.formatIndexRanges(g.ids);
      warnings.push({
        type: "info",
        message: `💡 Gợi ý (${g.ids.length} thanh): Các thanh ${range} chỉ dùng ${g.used}mm. Hãy cân nhắc giảm "Kích thước Min" xuống ${g.suggest}mm.`,
      });
    });

    // D. Dùng kích thước gần Min (Info) - Cái này giữ nguyên logic gộp cũ
    const minStocks = stocks.filter(
      (s) => !s.isExisting && s.length < config.minLength + 500,
    );
    if (minStocks.length > 0) {
      warnings.push({
        type: "info",
        message: `ℹ️ Có ${minStocks.length} thanh sử dụng kích thước gần Min (${config.minLength}mm).`,
      });
    }

    return warnings;
  }

  /**
   * Helper: Format mảng index thành range (VD: 1,2,3,5 -> "#1-#3, #5")
   */
  formatIndexRanges(indices) {
    if (!indices || indices.length === 0) return "";
    indices.sort((a, b) => a - b);

    const ranges = [];
    let start = indices[0];
    let prev = indices[0];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== prev + 1) {
        ranges.push(start === prev ? `#${start}` : `#${start}-#${prev}`);
        start = indices[i];
      }
      prev = indices[i];
    }
    ranges.push(start === prev ? `#${start}` : `#${start}-#${prev}`);

    return ranges.join(", ");
  }

  /**
   * Multi-Stock Optimization (Nâng cao - Phase 2)
   * Thử kết hợp nhiều kích thước khác nhau
   */
  /**
   */
  multiStockOptimization(items, config) {
    let remainingItems = [...items];
    const finalStocks = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5; // Tránh lặp vô hạn

    while (remainingItems.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // 1. Tìm kích thước tốt nhất cho lô hàng hiện tại
      const bestResult = this.findOptimalStockLength(remainingItems, config);

      // Nếu không tìm được, break
      if (!bestResult) break;

      // 2. Lọc ra các thanh "Tốt" (Good Stocks)
      // 🛑 FIX: Thắt chặt điều kiện. Chỉ chấp nhận thanh có phế liệu <= maxWaste
      // Bỏ điều kiện < 10% vì nó quá lỏng với thanh dài (VD: 10% của 6000 là 600mm > 100mm maxWaste)
      const goodStocks = bestResult.stocks.filter((stock) => {
        return stock.remaining <= config.maxWaste;
      });

      // 3. Xử lý trường hợp không có thanh nào đạt chuẩn
      // Nếu không có thanh nào <= maxWaste, ta thử tìm những thanh "tạm chấp nhận được"
      // (Ví dụ: phế liệu chỉ nhỉnh hơn chút xíu, hoặc hiệu suất rất cao > 98%)
      if (goodStocks.length === 0) {
        const acceptableStocks = bestResult.stocks.filter((stock) => {
          const wastePercent = stock.remaining / stock.length;
          return wastePercent < 0.02; // Chỉ chấp nhận nếu phế liệu < 2% (rất tối ưu)
        });

        if (acceptableStocks.length > 0) {
          finalStocks.push(...acceptableStocks);

          // Những thanh còn lại (tệ thật sự) sẽ đẩy xuống vòng lặp
          const badStocks = bestResult.stocks.filter(
            (s) => !acceptableStocks.includes(s),
          );
          const nextItems = [];
          badStocks.forEach((stock) => nextItems.push(...stock.cuts));
          remainingItems = nextItems;

          if (remainingItems.length === 0) break; // Xong hết
          continue; // Tiếp tục vòng lặp với items còn lại
        }

        // Nếu tất cả đều tệ và không thể tối ưu hơn, đành chấp nhận kết quả hiện tại
        finalStocks.push(...bestResult.stocks);
        remainingItems = [];
        break;
      }

      // 4. Chấp nhận các thanh tốt
      finalStocks.push(...goodStocks);

      // 5. Lấy các item từ các thanh "Tệ" (remaining > maxWaste) để tối ưu lại
      const badStocks = bestResult.stocks.filter((stock) => {
        return stock.remaining > config.maxWaste;
      });

      const nextItems = [];
      badStocks.forEach((stock) => {
        nextItems.push(...stock.cuts);
      });

      remainingItems = nextItems;
    }

    // Nếu vẫn còn hàng sau khi hết số vòng lặp tối đa
    if (remainingItems.length > 0) {
      const lastResult = this.findOptimalStockLength(remainingItems, config);
      finalStocks.push(...lastResult.stocks);
    }

    return {
      stocks: finalStocks,
      // Nếu chỉ có 1 loại kích thước, trả về kích thước đó. Nếu nhiều, trả về "Đa kích thước"
      stockLength: this.detectStockLengthType(finalStocks),
    };
  }

  /**
   * Helper để xác định loại kích thước kết quả
   */
  detectStockLengthType(stocks) {
    if (stocks.length === 0) return 0;
    const firstLen = stocks[0].length;
    const isSingle = stocks.every((s) => s.length === firstLen);
    return isSingle ? firstLen : "Đa kích thước"; // String này sẽ hiển thị ở UI
  }
}

// Export để sử dụng trong app.js



/* Production planning: deterministic grouping shared by UI and workbook. */
function productionPatterns(stocks) {
  const groups = new Map();
  stocks.forEach(s => {
    const cuts = [...s.cuts].sort((a,b)=>b-a);
    const key = JSON.stringify([s.length,s.isExisting,cuts]);
    if (!groups.has(key)) groups.set(key,{...s,cuts,count:0});
    groups.get(key).count++;
  });
  return [...groups.values()].sort((a,b)=>b.count-a.count || b.length-a.length)
    .map((s,i)=>({...s,id:`A${String(i+1).padStart(2,'0')}`}));
}
function patternWarnings(result,config){
  const warnings=result.patterns.filter(p=>p.remaining>config.maxWaste+1e-7).map(p=>({
    type:'warning',patternId:p.id,count:p.count,remaining:p.remaining,
    percent:100*p.remaining/p.length,totalRemaining:p.remaining*p.count,
    message:`${p.id}: ${p.count} thanh, dư ${p.remaining} mm/thanh.`
  }));
  const types=new Set(result.stocks.filter(s=>!s.isExisting).map(s=>s.length)).size;
  if(config.stockMode==='custom'&&types>config.maxStockTypes)warnings.push({type:'info',message:`${types} loại phôi; mục tiêu ${config.maxStockTypes}.`});
  return warnings;
}
// Warnings are computed only after the final pattern IDs and totals exist.
CuttingOptimizer.prototype.generateWarnings=function(){return [];};

CuttingOptimizer.prototype.optimize = function(items, config, inventory=[]) {
  const c = {stockMode:'custom',fixedLength:6000,endAllowance:0,orderIncrement:1,mergeTolerance:0,...config};
  if(!['custom','standard','fixed'].includes(c.stockMode))throw new Error('Chọn cách cấp phôi hợp lệ.');
  if(c.stockMode==='fixed'){
    if(!Number.isFinite(c.fixedLength)||c.fixedLength<=0)throw new Error('Chiều dài phôi cố định phải là số dương.');
    if(!Number.isFinite(c.endAllowance)||c.endAllowance<0||c.endAllowance>=c.fixedLength)throw new Error('Dư gia công phải nhỏ hơn chiều dài phôi cố định.');
    c.minLength=c.maxLength=c.fixedLength;c.stepSize=1;c.maxStockTypes=1;
  }
  if(c.stockMode!=='custom'){c.orderIncrement=1;c.mergeTolerance=0;}
  if(c.stockMode==='standard')c.endAllowance=0;
  for(const k of ['endAllowance','orderIncrement','mergeTolerance'])if(!Number.isFinite(c[k])||c[k]<0||(k==='orderIncrement'&&c[k]===0))throw new Error('Kiểm tra dư gia công, bước làm tròn và khoảng gộp phôi.');
  for (const rows of [items,inventory]) for (const row of rows) {
    if (!Number.isFinite(row.length) || row.length<=0 || !Number.isSafeInteger(row.quantity) || row.quantity<=0)
      throw new Error('Chiều dài phải dương; số lượng phải là số nguyên dương.');
  }
  if (!items.length) throw new Error('Chưa có chi tiết.');
  if(c.stockMode==='custom')c.stepSize=1;
  for (const key of ['kerf','maxWaste','minLength','maxLength','stepSize'])
    if (!Number.isFinite(c[key])) throw new Error('Thông số không hợp lệ.');
  if(c.kerf<0 || c.maxWaste<0 || c.minLength<=0 || c.maxLength<c.minLength || c.stepSize<=0)
    throw new Error('Kiểm tra Min, Max, bước phôi và mạch cắt.');
  if((c.stockMode==='standard'&&(c.maxLength-c.minLength)/c.stepSize>1000) || [...items,...inventory].reduce((s,r)=>s+r.quantity,0)>20000)
    throw new Error('Lô quá lớn: tối đa 20.000 thanh/chi tiết và 1.001 bước phôi. Hãy chia lô.');
  c.maxTypes = Number(c.maxTypes || 2);
  if (![1,2,3].includes(c.maxTypes)) throw new Error('Chọn từ 1 đến 3 loại chi tiết/mẫu.');
  c.maxStockTypes=Number(c.maxStockTypes ?? 3);
  if(!Number.isInteger(c.maxStockTypes)||c.maxStockTypes<1||c.maxStockTypes>5) throw new Error('Chọn từ 1 đến 5 loại phôi mới.');
  const simple = c.productionMode !== 'material';
  const fits = (s,l)=>s.remaining+1e-7>=l+(s.cuts.length?c.kerf:0) &&
    (!simple || s.cuts.includes(l) || new Set(s.cuts).size<c.maxTypes);
  const place = (s,l)=>{s.remaining-=l+(s.cuts.length?c.kerf:0);s.cuts.push(l);};
  let remaining=this.expandItems(items).sort((a,b)=>b-a), used=[];
  for(const length of this.expandItems(inventory).sort((a,b)=>a-b)) {
    const s={length,cuts:[],remaining:length,isExisting:true};
    remaining=remaining.filter(l=>{if(fits(s,l)){place(s,l);return false;}return true;});
    if(s.cuts.length) used.push(s);
  }
  let result;
  if(!remaining.length) result=this.combineResults(used,null,this.expandItems(items).length,c);
  else if(c.stockMode==='fixed') {
    const usable=c.fixedLength-c.endAllowance;
    if(remaining[0]>usable)throw new Error(`Chi tiết ${remaining[0]} mm dài hơn phần dùng được ${usable} mm của phôi cố định ${c.fixedLength} mm.`);
    const best=this.productionStockSearch(remaining,{...c,minLength:usable,maxLength:usable,stepSize:1},simple?c.maxTypes:Infinity);
    for(const stock of best.stocks){stock.length=c.fixedLength;stock.allowance=c.endAllowance;}
    best.stockLength=c.fixedLength;
    result=this.combineResults(used,best,this.expandItems(items).length,c);
  } else if(c.stockMode==='custom') {
    result=this.combineResults(used,this.customStockPlanning(remaining,c,simple?c.maxTypes:Infinity),this.expandItems(items).length,c);
  } else if(!simple) {
    // Include upper bound even if the step grid misses it; never reject usable inventory first.
    const best=this.productionStockSearch(remaining,c,Infinity);
    result=this.combineResults(used,best,this.expandItems(items).length,c);
  } else {
    const best=this.productionStockSearch(remaining,c,c.maxTypes);
    result=this.combineResults(used,best,this.expandItems(items).length,c);
  }
  result.patterns=productionPatterns(result.stocks);
  result.inputItems=items.map(i=>({...i}));
  result.allowanceLoss=result.stocks.reduce((sum,s)=>sum+(s.allowance||0),0);
  result.kerfLoss=result.totalLength-result.totalUsed-result.totalWaste-result.allowanceLoss;
  result.efficiency=(100*result.totalUsed/result.totalLength).toFixed(2);
  result.newStocks=result.stocks.filter(s=>!s.isExisting).length;
  result.config={...c};
  result.summary=[];
  for(const s of result.stocks){let r=result.summary.find(r=>r.length===s.length && r.isExisting===s.isExisting);
    if(!r){r={length:s.length,isExisting:s.isExisting,quantity:0};result.summary.push(r);}r.quantity++;}
  result.warnings=patternWarnings(result,c);
  this.results=result; return result;
};
CuttingOptimizer.prototype.productionStockSearch=function(items,c,limit){
  const lengths=[];for(let l=c.minLength;l<=c.maxLength;l+=c.stepSize) lengths.push(l);
  if(lengths[lengths.length-1]!==c.maxLength) lengths.push(c.maxLength);
  let best=null,bestScore=null;
  for(const length of lengths){
    if(length<items[0]) continue;
    const stocks=[];
    for(const l of items){
      let s=stocks.find(s=>s.remaining+1e-7>=l+(s.cuts.length?c.kerf:0) && (s.cuts.includes(l)||new Set(s.cuts).size<limit));
      if(!s){s={length,cuts:[],remaining:length,isExisting:false};stocks.push(s);}
      s.remaining-=l+(s.cuts.length?c.kerf:0);s.cuts.push(l);
    }
    // Compare the uniform plan and a compacted plan. Round UP on the allowed
    // purchase grid, including Max; never change cuts or the worker type limit.
    const compact=stocks.map(s=>{
      const occupied=s.length-s.remaining;
      const shorter=lengths.find(l=>l+1e-7>=occupied);
      return {...s,cuts:[...s.cuts],length:shorter,remaining:Math.max(0,shorter-occupied)};
    });
    for(const plan of [stocks,compact]) {
      if(new Set(plan.map(s=>s.length)).size>c.maxStockTypes)continue;
      const patterns=productionPatterns(plan).length,total=plan.reduce((sum,s)=>sum+s.length,0);
      // Material is primary: a small pattern count must never justify huge waste.
      const score=[total,patterns,new Set(plan.map(s=>s.length)).size,plan.length];
      const better=!bestScore || score.some((v,i)=>v<bestScore[i] && score.slice(0,i).every((x,j)=>x===bestScore[j]));
      if(better){best={stocks:plan,stockLength:this.detectStockLengthType(plan)};bestScore=score;}
    }
  }
  if(!best) throw new Error('Có chi tiết dài hơn mọi phôi mới khả dụng.');
  return best;
};

/* Made-to-order stock: form repeatable cutting recipes, then size the stock. */
CuttingOptimizer.prototype.customStockPlanning=function(items,c,limit){
  const allowance=c.endAllowance,unit=c.orderIncrement;
  const size=cuts=>Math.ceil((Math.max(c.minLength,cuts.reduce((s,l)=>s+l,0)+Math.max(0,cuts.length-1)*c.kerf+allowance)-1e-8)/unit)*unit;
  const make=cuts=>({cuts:[...cuts],length:size(cuts),remaining:size(cuts)-cuts.reduce((s,l)=>s+l,0)-Math.max(0,cuts.length-1)*c.kerf-allowance,isExisting:false,allowance});
  const counts=new Map();items.forEach(l=>counts.set(l,(counts.get(l)||0)+1));
  const feasible=cuts=>new Set(cuts).size<=limit&&size(cuts)<=c.maxLength+1e-7;
  let best=null,score=null;
  for(const strategy of ['full','divisor']){
    const stocks=[],left=[];
    for(const [l,q] of [...counts].sort((a,b)=>b[0]-a[0])){
      let k=Math.min(q,Math.floor((c.maxLength-allowance+c.kerf)/(l+c.kerf)));
      while(k>0&&!feasible(Array(k).fill(l)))k--;
      if(!k)throw new Error(`Chi tiết ${l} mm không vừa phôi sau khi cộng dư gia công và làm tròn.`);
      if(strategy==='divisor'){
        let divisor=k;while(divisor>1&&(q%divisor||size(Array(divisor).fill(l))>c.maxLength))divisor--;
        // Do not sacrifice minimum production length just to obtain a divisor.
        if(l*divisor+(divisor-1)*c.kerf+allowance>=c.minLength)k=divisor;
      }
      for(let n=0;n<Math.floor(q/k);n++)stocks.push(make(Array(k).fill(l)));
      for(let n=0;n<q%k;n++)left.push(l);
    }
    // Place residuals in a repeated recipe where there is room, or form a tail recipe.
    for(const l of left.sort((a,b)=>b-a)){
      let target=stocks.filter(s=>feasible([...s.cuts,l])).sort((a,b)=>size([...a.cuts,l])-size([...b.cuts,l]))[0];
      if(target)Object.assign(target,make([...target.cuts,l]));else stocks.push(make([l]));
    }
    // Merge nearby purchase lengths upwards only. The full span is bounded.
    const lengths=[...new Set(stocks.map(s=>s.length))].sort((a,b)=>b-a);
    const targets=[];
    for(const length of lengths){const near=targets.find(t=>t-length<=c.mergeTolerance+1e-7);if(near===undefined)targets.push(length);}
    for(const stock of stocks){const t=targets.filter(t=>t>=stock.length-1e-7&&t-stock.length<=c.mergeTolerance+1e-7).sort((a,b)=>a-b)[0];stock.remaining+=t-stock.length;stock.length=t;}
    const waste=stocks.reduce((s,r)=>s+r.remaining,0),patterns=productionPatterns(stocks).length,types=new Set(stocks.map(s=>s.length)).size;
    const candidate=[waste,patterns,types,stocks.length];
    if(!score||candidate.some((v,i)=>v<score[i]-1e-7&&candidate.slice(0,i).every((v,j)=>Math.abs(v-score[j])<1e-7))){best=stocks;score=candidate;}
  }
  return {stocks:best,stockLength:this.detectStockLengthType(best)};
};

export default CuttingOptimizer;
