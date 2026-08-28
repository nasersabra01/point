

// // Revenue Chart
// const revCtx = document.getElementById('revenueChart').getContext('2d');
// const grad1 = revCtx.createLinearGradient(0, 0, 0, 220);
// grad1.addColorStop(0, 'rgba(59,130,246,.35)');
// grad1.addColorStop(1, 'rgba(59,130,246,0)');
// const grad2 = revCtx.createLinearGradient(0, 0, 0, 220);
// grad2.addColorStop(0, 'rgba(139,92,246,.25)');
// grad2.addColorStop(1, 'rgba(139,92,246,0)');

// new Chart(revCtx, {
//     type: 'line',
//     data: {
//         labels: ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
//         datasets: [
//             {
//                 label: 'المبيعات 2026',
//                 data: [42, 55, 48, 70, 63, 88, 75, 92, 85, 98, 110, 125],
//                 borderColor: '#3B82F6',
//                 backgroundColor: grad1,
//                 borderWidth: 2.5,
//                 pointRadius: 4,
//                 pointBackgroundColor: '#3B82F6',
//                 tension: 0.4,
//                 fill: true
//             },
//             {
//                 label: 'المبيعات 2025',
//                 data: [30, 40, 35, 55, 50, 68, 60, 75, 70, 82, 90, 100],
//                 borderColor: '#8B5CF6',
//                 backgroundColor: grad2,
//                 borderWidth: 2,
//                 pointRadius: 3,
//                 pointBackgroundColor: '#8B5CF6',
//                 tension: 0.4,
//                 fill: true,
//                 borderDash: [5, 4]
//             }
//         ]
//     },
//     options: {
//         responsive: true,
//         plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, padding: 16, font: { size: 12 } } } },
//         scales: {
//             x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { font: { size: 11 } } },
//             y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { font: { size: 11 }, callback: v => v + 'ك' } }
//         }
//     }
// });

// // Pie / Doughnut Chart
// const pieCtx = document.getElementById('pieChart').getContext('2d');
// new Chart(pieCtx, {
//     type: 'doughnut',
//     data: {
//         labels: ['إلكترونيات', 'أزياء', 'جمال', 'طعام', 'رياضة'],
//         datasets: [{
//             data: [35, 28, 18, 11, 8],
//             backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'],
//             borderWidth: 0,
//             hoverOffset: 8
//         }]
//     },
//     options: {
//         responsive: true,
//         cutout: '68%',
//         plugins: {
//             legend: { position: 'left', labels: { boxWidth: 12, padding: 18, font: { size: 12 } } }
//         }
//     }
// });
